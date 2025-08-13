from typing import Iterable
from decimal import Decimal, ROUND_HALF_EVEN

def _r(v) -> Decimal:
    """Runde banker’s rounding auf 2 Nachkommastellen."""
    return Decimal(v).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)

def compute_line_totals(qty: float, unit_price: float, vat_rate: float) -> dict:
    """Berechnet Nettobetrag, USt und Brutto für 1 Position."""
    net = _r(Decimal(qty) * Decimal(unit_price))
    vat = _r(net * Decimal(vat_rate) / Decimal(100))
    gross = _r(net + vat)
    return {"net": net, "vat": vat, "gross": gross}

def compute_totals(lines: Iterable[dict]) -> dict:
    """Summiert alle Positionen und liefert Netto, USt, Brutto."""
    net_sum = Decimal("0.00")
    vat_sum = Decimal("0.00")
    for ln in lines:
        # Wenn steuerpflichtig (S), nimm rate; bei steuerfrei (E) nimm 0
        rate = ln["vat"]["rate"] if ln["vat"]["category"] == "S" else 0
        t = compute_line_totals(ln["qty"], ln["net_unit_price"], rate)
        net_sum += t["net"]; vat_sum += t["vat"]
    return {"net": _r(net_sum), "vat": _r(vat_sum), "gross": _r(net_sum + vat_sum)}

