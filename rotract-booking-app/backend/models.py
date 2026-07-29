from datetime import date, time, datetime
from typing import Optional
from sqlmodel import Field, SQLModel

class Bookings(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    booking_date: date
    start_time: time
    end_time: time
    category: str
    note: Optional[str] = None
    delete_code: str
    created_at: datetime = Field(default_factory=datetime.utcnow)