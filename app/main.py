from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from io import BytesIO
import zipfile
import tempfile, os

from app.models import Invoice
from app.validation import validate_invoice
from app.exporter import render_ubl_xml
from app.totals import compute_totals
from app.pdf import render_pdf

app = FastAPI(title="XBill Mini")

@app.get("/health")
def health():
    return {"ok": True, "app": "xbill-mini"}

@app.post("/validate")
def validate(inv: Invoice):
    payload = inv.model_dump()
    errors = validate_invoice(payload)
    if errors:
        return JSONResponse({"valid": False, "errors": errors}, status_code=400)
    return {"valid": True}

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
        with open(xml_path, "wb") as f:
            f.write(xml_bytes)
        render_pdf(pdf_path, payload, totals)

        buf = BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(xml_path, arcname=os.path.basename(xml_path))
            z.write(pdf_path, arcname=os.path.basename(pdf_path))
        buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{payload["header"]["number"]}.zip"'}
    )

