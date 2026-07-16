from pydantic import BaseModel


class FeedbackCreate(BaseModel):
    message: str
    contact: str | None = None
    context: str


class FeedbackPublic(BaseModel):
    id: int
    message: str
    contact: str | None
    context: str

    model_config = {"from_attributes": True}
