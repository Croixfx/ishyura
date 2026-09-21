"""
Ishyura Backend - Soft Registration & QR Code Service
Stack: FastAPI, SQLAlchemy 2.0 (Async + aiosqlite), Pydantic v2, Python-Jose, Passlib
"""

import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Dict, List, Optional

import httpx
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, select
from sqlalchemy.ext.asyncio import (
    AsyncAttrs,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# =====================================================================
# 1. CONFIGURATION & SECURITY SETTINGS
# =====================================================================

DATABASE_URL = "sqlite+aiosqlite:///./ishyura.db"
SECRET_KEY = os.getenv("SECRET_KEY", "ishyura-super-secret-jwt-key-change-in-production-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/verify-otp")

# In-memory OTP storage: {phone_number: {"code": "123456", "expires_at": datetime}}
OTP_STORE: Dict[str, Dict[str, Any]] = {}

# SMS Gateway Configuration (Twilio)
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")
TWILIO_VERIFY_SERVICE_SID = os.getenv("TWILIO_VERIFY_SERVICE_SID", "")
# Note: Other providers (e.g., Africa's Talking, Infobip) will be integrated later.


# =====================================================================
# 2. DATABASE MODELS (SQLAlchemy 2.0 Async)
# =====================================================================

class Base(AsyncAttrs, DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    phone_number: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        index=True,
        nullable=False,
    )
    is_fully_registered: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    email: Mapped[Optional[str]] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
        index=True,
    )
    hashed_password: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )

    # 1-to-many relationship to QRCodes
    qr_codes: Mapped[List["QRCode"]] = relationship(
        "QRCode",
        back_populates="owner",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class QRCode(Base):
    __tablename__ = "qr_codes"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )
    description: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship back to User
    owner: Mapped["User"] = relationship(
        "User",
        back_populates="qr_codes",
    )


# Async database engine & session maker
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    """Dependency for obtaining an async database session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# =====================================================================
# 3. PYDANTIC V2 SCHEMAS
# =====================================================================

class RequestOTPRequest(BaseModel):
    phone_number: str = Field(
        ...,
        examples=["+250788123456", "0788123456"],
        description="User Rwandan or international phone number",
    )


class VerifyOTPRequest(BaseModel):
    phone_number: str
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: uuid.UUID
    phone_number: str
    is_fully_registered: bool


class UpgradeAccountRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password with minimum 6 characters")


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone_number: str
    is_fully_registered: bool
    email: Optional[str] = None


class QRCodeCreate(BaseModel):
    amount: Optional[float] = Field(None, ge=0, description="Optional payment amount in RWF")
    description: str = Field(..., min_length=1, max_length=255, description="Shop/Counter note or reason")


class QRCodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    amount: Optional[float]
    description: str
    created_at: datetime


class MessageResponse(BaseModel):
    message: str
    delivery_status: str = "sent"
    provider: Optional[str] = None
    otp_preview: Optional[str] = None


# =====================================================================
# 4. AUTHENTICATION & SECURITY UTILITIES
# =====================================================================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def format_e164(phone_number: str) -> str:
    """Format Rwandan (078/079/072/073) or international phone numbers to E.164."""
    clean = phone_number.replace("+", "").replace(" ", "").replace("-", "")
    if clean.startswith("0") and len(clean) == 10:
        return f"+250{clean[1:]}"
    elif clean.startswith("250") and len(clean) == 12:
        return f"+{clean}"
    elif not phone_number.startswith("+"):
        return f"+{clean}"
    return f"+{clean}"


async def send_real_otp_sms(phone_number: str) -> Dict[str, Any]:
    """
    Generates a 6-digit OTP and attempts real SMS delivery via Twilio.
    Supports:
    - Twilio Programmable Messaging (SMS API)
    - Twilio Verify Service API (if TWILIO_VERIFY_SERVICE_SID is configured)
    Falls back gracefully to local console logging if Twilio credentials are not yet set in .env.
    (Note: Additional providers like Africa's Talking will be integrated later).
    """
    code = f"{random.randint(100000, 999999)}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    OTP_STORE[phone_number] = {"code": code, "expires_at": expires_at}

    formatted_recipient = format_e164(phone_number)
    sms_text = f"Your Ishyura verification code is: {code}. Valid for 10 minutes. Do not share this code."

    # 1. Twilio Verify API (if TWILIO_VERIFY_SERVICE_SID is configured)
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID:
        try:
            url = f"https://verify.twilio.com/v2/Services/{TWILIO_VERIFY_SERVICE_SID}/Verifications"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    url,
                    data={"To": formatted_recipient, "Channel": "sms"},
                    auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
                )
                if resp.is_success:
                    print(f"✅ [TWILIO VERIFY DISPATCHED] Real OTP sent to {formatted_recipient}")
                    return {
                        "delivered": True,
                        "provider": "twilio",
                        "message": f"Real OTP sent to {formatted_recipient} via Twilio Verify.",
                    }
                else:
                    print(f"⚠️ [TWILIO VERIFY ERROR] Status {resp.status_code}: {resp.text}")
        except Exception as ex:
            print(f"⚠️ [TWILIO VERIFY EXCEPTION] {ex}")

    # 2. Twilio Programmable SMS
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER:
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    url,
                    data={
                        "From": TWILIO_PHONE_NUMBER,
                        "To": formatted_recipient,
                        "Body": sms_text,
                    },
                    auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
                )
                if resp.is_success:
                    print(f"✅ [TWILIO SMS SENT] Real SMS dispatched to {formatted_recipient}")
                    return {
                        "delivered": True,
                        "provider": "twilio",
                        "message": f"Real OTP sent to {formatted_recipient} via Twilio SMS.",
                    }
                else:
                    print(f"⚠️ [TWILIO ERROR] Status {resp.status_code}: {resp.text}")
        except Exception as ex:
            print(f"⚠️ [TWILIO EXCEPTION] {ex}")

    # Fallback simulation when Twilio credentials are not yet set in environment
    print("\n" + "=" * 60)
    print(f"📲 [TWILIO REAL OTP ENGINE]")
    print(f"   Recipient Phone   : {phone_number} -> {formatted_recipient}")
    print(f"   Verification Code : {code}")
    print(f"   Message           : {sms_text}")
    print(f"   Notice            : Live Twilio credentials not found in .env.")
    print(f"                       Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and")
    print(f"                       TWILIO_PHONE_NUMBER to dispatch live telecom SMS.")
    print("=" * 60 + "\n", flush=True)

    return {
        "delivered": False,
        "provider": "simulator",
        "otp_preview": code,
        "message": f"Code generated for {formatted_recipient}. (Configure TWILIO_* in .env to deliver real SMS)",
    }



def create_access_token(user_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": str(user_id), "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Dependency that validates JWT and returns the User model instance."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: Optional[str] = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception
    return user


# =====================================================================
# 5. FASTAPI APPLICATION & LIFESPAN
# =====================================================================

app = FastAPI(
    title="Ishyura Backend API",
    description="Backend for Ishyura payment QR platform with Soft Registration & account upgrade.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    """Create database tables on startup if they don't already exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# =====================================================================
# 6. API ENDPOINTS
# =====================================================================

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ishyura-backend"}


@app.post(
    "/auth/request-otp",
    response_model=MessageResponse,
    summary="Request OTP (Triggers Soft Registration if user is new)",
)
async def request_otp(
    payload: RequestOTPRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cleaned_phone = payload.phone_number.strip().replace(" ", "")

    stmt = select(User).where(User.phone_number == cleaned_phone)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        new_user = User(
            phone_number=cleaned_phone,
            is_fully_registered=False,
        )
        db.add(new_user)
        await db.commit()

    delivery = await send_real_otp_sms(cleaned_phone)

    return MessageResponse(
        message=delivery.get("message", f"Verification code sent to {cleaned_phone}."),
        delivery_status="sent" if delivery.get("delivered") else "simulated",
        provider=delivery.get("provider"),
        otp_preview=delivery.get("otp_preview"),
    )


@app.post(
    "/auth/verify-otp",
    response_model=TokenResponse,
    summary="Verify OTP & receive JWT Access Token",
)
async def verify_otp(
    payload: VerifyOTPRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cleaned_phone = payload.phone_number.strip().replace(" ", "")

    otp_record = OTP_STORE.get(cleaned_phone)
    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending OTP request found for this phone number. Please request one first.",
        )

    if datetime.now(timezone.utc) > otp_record["expires_at"]:
        del OTP_STORE[cleaned_phone]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP code has expired. Please request a new code.",
        )

    if otp_record["code"] != payload.otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code.",
        )

    del OTP_STORE[cleaned_phone]

    stmt = select(User).where(User.phone_number == cleaned_phone)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User record not found.",
        )

    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        phone_number=user.phone_number,
        is_fully_registered=user.is_fully_registered,
    )


@app.post(
    "/auth/upgrade",
    response_model=UserResponse,
    summary="Upgrade soft user to full account (email + password)",
)
async def upgrade_account(
    payload: UpgradeAccountRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if current_user.is_fully_registered:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account is already fully registered.",
        )

    stmt = select(User).where(User.email == payload.email)
    result = await db.execute(stmt)
    existing_email_user = result.scalar_one_or_none()

    if existing_email_user and existing_email_user.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already in use by another account.",
        )

    current_user.email = payload.email
    current_user.hashed_password = hash_password(payload.password)
    current_user.is_fully_registered = True

    await db.commit()
    await db.refresh(current_user)

    return current_user


@app.post(
    "/qr/create",
    response_model=QRCodeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new QR Code record for the authenticated user",
)
async def create_qr_code(
    payload: QRCodeCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    new_qr = QRCode(
        owner_id=current_user.id,
        amount=payload.amount,
        description=payload.description.strip(),
    )
    db.add(new_qr)
    await db.commit()
    await db.refresh(new_qr)
    return new_qr


@app.get(
    "/qr/list",
    response_model=List[QRCodeResponse],
    summary="List all QR codes generated by the authenticated user",
)
async def list_qr_codes(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = (
        select(QRCode)
        .where(QRCode.owner_id == current_user.id)
        .order_by(QRCode.created_at.desc())
    )
    result = await db.execute(stmt)
    qr_codes = result.scalars().all()
    return qr_codes


@app.get(
    "/users/me",
    response_model=UserResponse,
    summary="Get current user profile and registration status",
)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
):
    return current_user


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
