from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from io import BytesIO
import zipfile
import tempfile
import os

from app.models import Invoice
from app.validation import validate_invoice
from app.exporter import render_ubl_xml
from app.totals import compute_totals
from app.pdf import render_pdf
from app.mailer import send_email_smtp

app = FastAPI(title="XBill Mini")


# ---- Health & Sample ---------------------------------------------------------

@app.get("/health")
def health():
    return {"ok": True, "app": "xbill-mini"}

@app.get("/sample")
def sample():
    return {
        "mode": "B2B",
        "header": {"number": "2025-001", "issue_date": "2025-08-13", "currency": "EUR"},
        "seller": {
            "name": "Studio Presche",
            "vat_id": "DE123456789",
            "address": {"city": "Augsburg", "postcode": "86150", "country_code": "DE"},
            "contact": {"person": "Jan Presche", "phone": "+49 123", "email": "hi@example.com"},
        },
        "buyer": {
            "name": "Muster GmbH",
            "address": {"city": "München", "postcode": "80331", "country_code": "DE"},
        },
        "payment": {
            "means_code": "30",
            "iban": "DE89370400440532013000",
            "remittance": "Re 2025-001",
        },
        "lines": [
            {
                "id": "1",
                "name": "UX Workshop",
                "qty": 1,
                "unit_code": "DAY",
                "net_unit_price": 1200.0,
                "vat": {"category": "S", "rate": 19},
            }
        ],
    }


# ---- Validate ----------------------------------------------------------------

@app.post("/validate")
def validate(inv: Invoice):
    payload = inv.model_dump()
    errors = validate_invoice(payload)
    if errors:
        return JSONResponse({"valid": False, "errors": errors}, status_code=400)
    return {"valid": True}


# ---- Export (ZIP mit XML + PDF) ---------------------------------------------

@app.post("/export")
def export(inv: Invoice):
    payload = inv.model_dump()
    errors = validate_invoice(payload)
    if errors:
        raise HTTPException(400, detail=errors)

    xml_bytes = render_ubl_xml(payload)
    totals = compute_totals(payload["lines"])

    with tempfile.TemporaryDirectory() as tmp:
        xml_path = os.path.join(tmp, f"{payload['header']['number']}.xml")
        pdf_path = os.path.join(tmp, f"{payload['header']['number']}.pdf")

        # XML schreiben
        with open(xml_path, "wb") as f:
            f.write(xml_bytes)

        # PDF erzeugen
        render_pdf(pdf_path, payload, totals)

        # ZIP in RAM packen
        buf = BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(xml_path, arcname=os.path.basename(xml_path))
            z.write(pdf_path, arcname=os.path.basename(pdf_path))
        buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{payload["header"]["number"]}.zip"'},
    )


# ---- Export + E-Mail (MailHog lokal) ----------------------------------------

@app.post("/export_email")
def export_email(
    inv: Invoice,
    recipient: str = Query(..., description="Empfänger-E-Mail"),
    sender: str = Query("inbox@example.com", description="Absender (optional)"),
):
    payload = inv.model_dump()
    errors = validate_invoice(payload)
    if errors:
        raise HTTPException(400, detail=errors)

    # XML & Totals
    xml_bytes = render_ubl_xml(payload)
    totals = compute_totals(payload["lines"])

    # PDF in RAM erzeugen (über temp-Datei)
    with tempfile.TemporaryDirectory() as tmp:
        pdf_path = os.path.join(tmp, f"{payload['header']['number']}.pdf")
        render_pdf(pdf_path, payload, totals)
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

    # ZIP in RAM erzeugen
    buf_zip = BytesIO()
    with zipfile.ZipFile(buf_zip, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(f"{payload['header']['number']}.xml", xml_bytes)
        z.writestr(f"{payload['header']['number']}.pdf", pdf_bytes)
    buf_zip.seek(0)
    zip_bytes = buf_zip.read()

    # MailHog (ohne STARTTLS/ohne Login)
    SMTP_HOST = "127.0.0.1"
    SMTP_PORT = 1025
    SMTP_USER = ""
    SMTP_PASS = ""

    subject = f"E-Rechnung {payload['header']['number']}"
    body = "Hi,\nim Anhang findest du die E-Rechnung als XML & PDF sowie als ZIP.\n\nLG"
    attachments = [
        (f"{payload['header']['number']}.zip", zip_bytes, "application/zip"),
        (f"{payload['header']['number']}.xml", xml_bytes, "application/xml"),
        (f"{payload['header']['number']}.pdf", pdf_bytes, "application/pdf"),
    ]

    try:
        send_email_smtp(
            host=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASS,
            sender=sender,
            recipient=recipient,
            subject=subject,
            text=body,
            attachments=attachments,
            use_starttls=False,  # wichtig für MailHog (kann kein STARTTLS)
        )
    except Exception as e:
        raise HTTPException(500, detail=f"Mailversand fehlgeschlagen: {e}")

    return {"ok": True, "sent_to": recipient}

