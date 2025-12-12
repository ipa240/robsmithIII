"""Zitadel Authentication - supports both JWT and opaque tokens"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx
from functools import lru_cache
from sqlalchemy.orm import Session
from ..config import get_settings
from ..database import get_db

security = HTTPBearer(auto_error=False)
settings = get_settings()


@lru_cache(maxsize=1)
def get_zitadel_jwks():
    """Fetch Zitadel's JWKS (JSON Web Key Set)"""
    try:
        # Use HTTPS for JWKS fetch (Cloudflare redirects http to https)
        jwks_url = settings.zitadel_issuer.replace("http://", "https://") + "/oauth/v2/keys"
        response = httpx.get(jwks_url, timeout=10, follow_redirects=True)
        return response.json()
    except Exception as e:
        print(f"Failed to fetch JWKS: {e}")
        return None


def validate_opaque_token(token: str) -> dict:
    """Validate an opaque token by calling Zitadel's userinfo endpoint"""
    try:
        userinfo_url = settings.zitadel_issuer.replace("http://", "https://") + "/oidc/v1/userinfo"
        print(f"[AUTH] Validating opaque token via userinfo endpoint: {userinfo_url}")

        response = httpx.get(
            userinfo_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
            follow_redirects=True
        )

        if response.status_code == 200:
            userinfo = response.json()
            print(f"[AUTH] Userinfo response: sub={userinfo.get('sub')}, email={userinfo.get('email')}")
            return userinfo
        else:
            print(f"[AUTH] Userinfo request failed: {response.status_code} - {response.text[:200]}")
            return None
    except Exception as e:
        print(f"[AUTH] Error validating opaque token: {e}")
        return None


def decode_token(token: str) -> dict:
    """Decode and validate a Zitadel token (JWT or opaque)"""
    # Check if token looks like a JWT (3 parts separated by dots)
    is_jwt_format = token.count('.') == 2

    if is_jwt_format:
        # Try to decode as JWT first
        try:
            # Get JWKS
            jwks = get_zitadel_jwks()
            if not jwks:
                raise JWTError("Unable to fetch JWKS")

            # Decode without verification first to get the header
            unverified_header = jwt.get_unverified_header(token)

            # Find the matching key
            rsa_key = None
            for key in jwks.get("keys", []):
                if key["kid"] == unverified_header["kid"]:
                    rsa_key = key
                    break

            if not rsa_key:
                raise JWTError("No matching key found")

            # Decode and verify the token
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                issuer=settings.zitadel_issuer,
                audience=settings.zitadel_client_id,
                options={"verify_aud": bool(settings.zitadel_client_id)}
            )
            print(f"[AUTH] JWT validated successfully for sub={payload.get('sub')}")
            return payload

        except JWTError as e:
            print(f"[AUTH] JWT decode failed: {str(e)}, trying opaque token validation...")
    else:
        print(f"[AUTH] Token is not JWT format (has {token.count('.')} dots), validating as opaque token...")

    # Token is opaque or JWT decode failed - validate via userinfo
    userinfo = validate_opaque_token(token)
    if userinfo and userinfo.get("sub"):
        return userinfo

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid token"
    )


def fetch_userinfo(token: str) -> dict:
    """Fetch user info from Zitadel's userinfo endpoint"""
    try:
        # Use HTTPS for userinfo fetch (Cloudflare redirects http to https)
        userinfo_url = settings.zitadel_issuer.replace("http://", "https://") + "/oidc/v1/userinfo"
        response = httpx.get(
            userinfo_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
            follow_redirects=True
        )
        if response.status_code == 200:
            return response.json()
        print(f"Userinfo fetch failed: {response.status_code} - {response.text}")
        return {}
    except Exception as e:
        print(f"Error fetching userinfo: {e}")
        return {}


class CurrentUser:
    """Represents the authenticated user from Zitadel"""
    def __init__(self, payload: dict, userinfo: dict = None):
        # Merge payload with userinfo (userinfo takes precedence for user data)
        data = {**payload, **(userinfo or {})}
        self.zitadel_id = data.get("sub")
        self.email = data.get("email")
        self.email_verified = data.get("email_verified", False)
        self.name = data.get("name", "")
        self.given_name = data.get("given_name", "")
        self.family_name = data.get("family_name", "")
        self.roles = data.get("urn:zitadel:iam:org:project:roles", {})
        # Database user_id - set by get_current_user_with_db
        self.user_id: Optional[str] = None

    @property
    def is_admin(self) -> bool:
        return "admin" in self.roles


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> CurrentUser:
    """Dependency to get the current authenticated user"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    payload = decode_token(token)

    # If email not in token, fetch from userinfo endpoint
    userinfo = None
    if not payload.get("email"):
        userinfo = fetch_userinfo(token)

    return CurrentUser(payload, userinfo)


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[CurrentUser]:
    """Dependency to optionally get the current user (for public endpoints)"""
    if not credentials:
        return None

    try:
        token = credentials.credentials
        payload = decode_token(token)

        # If email not in token, fetch from userinfo endpoint
        userinfo = None
        if not payload.get("email"):
            userinfo = fetch_userinfo(token)

        return CurrentUser(payload, userinfo)
    except HTTPException:
        return None


async def require_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Dependency to require admin role"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def get_current_user_with_db(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> CurrentUser:
    """
    Dependency that gets current user and looks up their database user_id.
    Use this instead of get_current_user when you need access to the database user ID.
    """
    from sqlalchemy import text

    try:
        # Look up user by email (primary) or oauth_id (fallback)
        result = db.execute(
            text("""
                SELECT id FROM users
                WHERE email = :email
                   OR (oauth_provider = 'zitadel' AND oauth_provider_id = :oauth_id)
                LIMIT 1
            """),
            {"email": current_user.email, "oauth_id": current_user.zitadel_id}
        ).first()

        if result:
            current_user.user_id = str(result.id)
        else:
            # User not found in database - they might need to complete onboarding
            current_user.user_id = None
    except Exception as e:
        print(f"Error looking up database user: {e}")
        current_user.user_id = None

    return current_user
