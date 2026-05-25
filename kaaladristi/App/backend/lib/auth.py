"""
JWT authentication dependency for FastAPI endpoints.

Usage:
    from lib.auth import get_current_user_id

    @app.get('/api/some-endpoint/{user_id}')
    def endpoint(user_id: str, caller_id: str = Depends(get_current_user_id)):
        if caller_id != user_id:
            raise HTTPException(status_code=403, detail='Forbidden')
        ...
"""

import uuid as _uuid

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from lib.config import JWT_SECRET

_bearer = HTTPBearer(auto_error=False)

_ALGORITHM = 'HS256'


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """
    Verify the Bearer JWT and return the `sub` claim as a string.
    Raises 401 if the token is missing, malformed, or fails verification.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail='Authorization header missing')

    if not JWT_SECRET:
        raise HTTPException(status_code=500, detail='JWT_SECRET not configured')

    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail='Invalid or expired token')

    sub = payload.get('sub')
    if not sub:
        raise HTTPException(status_code=401, detail='Token missing sub claim')

    # Validate that sub is a well-formed UUID — prevents path-traversal style abuse
    try:
        _uuid.UUID(str(sub))
    except ValueError:
        raise HTTPException(status_code=401, detail='Token sub is not a valid UUID')

    return str(sub)
