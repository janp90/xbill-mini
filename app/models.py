from pydantic import BaseModel, Field
from typing import List, Optional, Literal


class Address(BaseModel):
    city: str
    postcode: str
    country_code: str  # ISO-2


class Contact(BaseModel):
    person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None  # Format prüfen wir serverseitig


class Party(BaseModel):
    name: str
    vat_id: Optional[str] = None
    address: Address
    contact: Optional[Contact] = None
    # WICHTIG: Leitweg-ID (nur beim Buyer relevant, beim Seller bleibt es None)
    reference: Optional[str] = None


class Header(BaseModel):
    number: str
    issue_date: str
    currency: Literal["EUR"] = "EUR"


class Payment(BaseModel):
    means_code: str = "30"
    iban: str
    remittance: Optional[str] = None


class LineVAT(BaseModel):
    category: Literal["S", "E"]
    rate: float


class Line(BaseModel):
    id: str
    name: str
    qty: float = Field(ge=0)
    unit_code: str
    net_unit_price: float = Field(ge=0)
    vat: LineVAT


class Invoice(BaseModel):
    mode: Literal["B2B", "B2G"] = "B2B"
    header: Header
    seller: Party
    buyer: Party
    payment: Payment
    lines: List[Line]
