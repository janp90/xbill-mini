from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
from lxml import etree
from .totals import compute_totals

# Jinja2-Umgebung: sucht Vorlagen im app/-Ordner
_env = Environment(
    loader=FileSystemLoader(str(Path(__file__).parent)),
    autoescape=select_autoescape(enabled_extensions=("xml",))
)

def render_ubl_xml(invoice: dict) -> bytes:
    """
    Rendert ein minimales UBL-XML (XRechnung-kompatible Basis).
    """
    totals = compute_totals(invoice["lines"])
    tpl = _env.get_template("ubl_template.xml")
    xml_str = tpl.render(
        header=invoice["header"],
        seller=invoice["seller"],
        buyer=invoice["buyer"],
        lines=invoice["lines"],
        totals=totals
    )
    # Well-formed + hübsch einrücken
    dom = etree.fromstring(xml_str.encode("utf-8"))
    return etree.tostring(dom, xml_declaration=True, encoding="UTF-8", pretty_print=True)

