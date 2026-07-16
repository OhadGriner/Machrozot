from httpx import AsyncClient


async def test_create_feedback(api: AsyncClient):
    response = await api.post(
        "/api/feedback",
        json={"message": "אהבתי את המשחק!", "context": "post_completion"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "אהבתי את המשחק!"
    assert data["context"] == "post_completion"
    assert data["contact"] is None


async def test_create_feedback_with_contact(api: AsyncClient):
    response = await api.post(
        "/api/feedback",
        json={"message": "בעיה במשחק", "contact": "player@example.com", "context": "post_completion"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["contact"] == "player@example.com"
