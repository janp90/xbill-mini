from pydantic import BaseModel, Field, EmailStr
from typing import List, Literal, Optional

class VAT(BaseModel):
    category: Literal["S", "E"]  # S = steuerpflichtig, E = steuerfrei
    rate: float = Field(ge=0)

class Line(BaseModel):
    id: str
    name: str
    qty: float = Field(ge=0)
    unit_code: Literal["C62", "HUR", "DAY"]
    net_unit_price: float = Field(ge=0)
    vat: VAT

class Address(BaseModel):
    city: str
    postcode: str
    country_code: str

class Contact(BaseModel):
    person: str
    phone: str
    email: EmailStr

class Party(BaseModel):
    name: str
    address: Address
    reference: Optional[str] = None  # B2G: Leitweg-ID

class Seller(BaseModel):
    name: str
    vat_id: Optional[str] = None
    address: Address
    contact: Contact

class Header(BaseModel):
    number: str
    issue_date: str   # YYYY-MM-DD
    currency: Literal["EUR"] = "EUR"

class Payment(BaseModel):
    means_code: Literal["30"] = "30"  # 30 = Überweisung
    iban: str
    remittance: Optional[str] = None

class Invoice(BaseModel):
    mode: Literal["B2G", "B2B"] = "B2B"
    header: Header
    seller: Seller
    buyer: Party
    payment: Payment
    lines: List[Line]

