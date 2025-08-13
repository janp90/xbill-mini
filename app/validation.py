import re
from typing import List, Dict, Any

IBAN_RE = re.compile(r"^[A-Z]{2}[0-9A-Z]{13,32}$")

def validate_invoice(payload: Dict[str, Any]) -> List[str]:
    """Zusätzliche Checks, die über die Pydantic-Grundprüfung hinausgehen."""
    errors: List[str] = []

    # B2G braucht Leitweg-ID (buyer.reference)
    if payload.get("mode") == "B2G":
        ref = (payload.get("buyer") or {}).get("reference")
        if not ref or not ref.strip():
            errors.append("buyer.reference: Leitweg-ID ist im B2G Pflicht.")

    # IBAN grob prüfen
    iban = (payload.get("payment") or {}).get("iban", "")
    if not IBAN_RE.match(iban):
        errors.append("payment.iban: IBAN sieht nicht korrekt aus (Großbuchstaben + Ziffern).")

    # USt-Logik je Position
    for i, ln in enumerate(payload.get("lines", []), start=1):
        cat = (ln.get("vat") or {}).get("category")
        rate = (ln.get("vat") or {}).get("rate")
        if cat == "S" and rate not in (7, 19):
            errors.append(f"lines[{i}].vat: Bei steuerpflichtig bitte 19% oder 7% wählen.")
        if cat == "E" and rate != 0:
            errors.append(f"lines[{i}].vat: Bei steuerfrei muss der Satz 0% sein.")
    return errors

