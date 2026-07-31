from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, select
from pydantic import BaseModel
from database import engine, get_session
from models import Bookings
from contextlib import asynccontextmanager
from contextlib import asynccontextmanager
from typing import Optional
from datetime import date, datetime, time
from fastapi import FastAPI, Depends, HTTPException, Query

# Automatically create tables on startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)
    yield

app = FastAPI(lifespan=lifespan)

# Enable CORS so the React frontend can communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],
)

# Pydantic model specifically for receiving the delete code safely
class DeleteRequest(BaseModel):
    delete_code: str


# Create booking endpoint with overlap validation
@app.post("/api/bookings")
def create_booking(booking: Bookings, session: Session = Depends(get_session)):

    # Convert strings to proper Python types (safety fix)
    if isinstance(booking.booking_date, str):
        booking.booking_date = date.fromisoformat(booking.booking_date)

    if isinstance(booking.start_time, str):
        booking.start_time = time.fromisoformat(booking.start_time)

    if isinstance(booking.end_time, str):
        booking.end_time = time.fromisoformat(booking.end_time)

    # ---------- Input validation ----------

    booking.name = booking.name.strip()

    if len(booking.name) < 2 or len(booking.name) > 50:
        raise HTTPException(
            status_code=400,
            detail="Name must be between 2 and 50 characters."
        )

    if booking.category not in ["Meeting", "Call", "Personal", "Event", "Other"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid category."
        )

    if booking.note and len(booking.note) > 300:
        raise HTTPException(
            status_code=400,
            detail="Note cannot exceed 300 characters."
        )

    if len(booking.delete_code) < 4 or len(booking.delete_code) > 64:
        raise HTTPException(
            status_code=400,
            detail="Delete code must be between 4 and 64 characters."
        )

    if booking.start_time >= booking.end_time:
        raise HTTPException(
            status_code=400,
            detail="End time must be after start time."
        )

    if booking.start_time < time(7, 0) or booking.end_time > time(21, 0):
        raise HTTPException(
            status_code=400,
            detail="Bookings are allowed only between 07:00 and 21:00."
        )

    # ---------- Existing validation ----------

    booking_datetime = datetime.combine(
        booking.booking_date,
        booking.start_time
    )

    if booking_datetime <= datetime.now():
        raise HTTPException(
            status_code=400,
            detail="You cannot reserve a past time slot."
        )

    statement = select(Bookings).where(
        Bookings.booking_date == booking.booking_date
    )

    existing_bookings_today = session.exec(statement).all()

    for existing in existing_bookings_today:

        new_start = booking.start_time
        new_end = booking.end_time

        exist_start = existing.start_time
        exist_end = existing.end_time

        if new_start < exist_end and new_end > exist_start:
            raise HTTPException(
                status_code=400,
                detail=f"Overlap error! This conflicts with an existing booking from {exist_start} to {exist_end}."
            )

    session.add(booking)
    session.commit()
    session.refresh(booking)

    return {
        "status": "success",
        "data": booking
    }

# Get bookings endpoint with dynamic sorting and filtering
@app.get("/api/bookings")
def get_bookings(
    filter_date: Optional[date] = Query(None, description="Filter by exact date"),
    filter_start_time: Optional[time] = Query(None, description="Filter by min start time"),
    category: Optional[str] = Query(None, description="Filter by category"),
    filter_end_time: Optional[time] = Query(None, description="Filter by max end time"),
    session: Session = Depends(get_session)
):
    statement = select(Bookings)
    
    if filter_date:
        statement = statement.where(Bookings.booking_date == filter_date)
    if filter_start_time:
        statement = statement.where(Bookings.start_time >= filter_start_time)
    if filter_end_time:
        statement = statement.where(Bookings.end_time <= filter_end_time)
    if category:
        statement = statement.where(Bookings.category == category)

    # Sort purely chronologically now
    statement = statement.order_by(Bookings.booking_date, Bookings.start_time)
        
    bookings = session.exec(statement).all()
    return {
    "status": "success",
    "data": [
        {
            "id": b.id,
            "name": b.name,
            "booking_date": b.booking_date,
            "start_time": b.start_time,
            "end_time": b.end_time,
            "category": b.category,
            "note": b.note,
            "created_at": b.created_at,
        }
        for b in bookings
    ]
}


# Delete booking endpoint with delete code verification
@app.delete("/api/bookings/{booking_id}")
def delete_booking(booking_id: int, payload: DeleteRequest, session: Session = Depends(get_session)):
    # Find the specific booking by its ID
    booking = session.get(Bookings, booking_id)
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
        
    # Verify the delete code matches
    if booking.delete_code != payload.delete_code:
        raise HTTPException(status_code=403, detail="Invalid delete code. You cannot delete this booking.")
        
    session.delete(booking)
    session.commit()
    return {"status": "success", "message": "Booking deleted successfully."}