from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

def render_pdf(path: str, invoice: dict, totals: dict) -> None:
    c = canvas.Canvas(path, pagesize=A4)
    w, h = A4
    y = h - 20*mm
    c.setFont("Helvetica-Bold", 14)
    c.drawString(20*mm, y, "Rechnung " + invoice["header"]["number"])
    y -= 8*mm
    c.setFont("Helvetica", 10)
    c.drawString(20*mm, y, f"Datum: {invoice['header']['issue_date']}   Währung: {invoice['header']['currency']}")
    y -= 12*mm
    c.drawString(20*mm, y, f"Verkäufer: {invoice['seller']['name']}")
    y -= 6*mm
    c.drawString(20*mm, y, f"Käufer: {invoice['buyer']['name']}")
    y -= 12*mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20*mm, y, "Positionen")
    y -= 6*mm
    c.setFont("Helvetica", 10)
    for ln in invoice["lines"]:
        c.drawString(20*mm, y, f"- {ln['name']}  {ln['qty']} {ln['unit_code']} x {ln['net_unit_price']} EUR")
        y -= 6*mm
        if y < 40*mm:
            c.showPage(); y = h - 20*mm
    y -= 8*mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20*mm, y, f"Netto: {totals['net']}  USt: {totals['vat']}  Brutto: {totals['gross']}  EUR")
    c.showPage()
    c.save()

