from datetime import date, timedelta

import pytest

NEXT_MONTH = (date.today() + timedelta(days=30)).isoformat()
NEXT_YEAR = (date.today() + timedelta(days=365)).isoformat()


@pytest.fixture
def existence(create_medication) -> dict:
    med = create_medication(existences=[{"due_date": NEXT_YEAR, "low_amount": False}])
    return med["existences"][0]


def test_update_low_amount_keeps_the_due_date(client, existence):
    response = client.patch(f"/existences/{existence['id']}", json={"low_amount": True})

    assert response.status_code == 200
    assert response.json() == {**existence, "low_amount": True}


def test_update_due_date_keeps_low_amount(client, existence):
    response = client.patch(
        f"/existences/{existence['id']}", json={"due_date": NEXT_MONTH}
    )

    assert response.status_code == 200
    assert response.json() == {**existence, "due_date": NEXT_MONTH}


@pytest.mark.parametrize("field", ["due_date", "low_amount"])
def test_update_rejects_null(client, existence, field):
    response = client.patch(f"/existences/{existence['id']}", json={field: None})

    assert response.status_code == 422


def test_update_missing_existence_is_404(client):
    response = client.patch("/existences/999999", json={"low_amount": True})

    assert response.status_code == 404
    assert response.json() == {"detail": "Existence not found"}


def test_delete_existence(client, create_medication):
    med = create_medication(
        existences=[
            {"due_date": NEXT_MONTH, "low_amount": False},
            {"due_date": NEXT_YEAR, "low_amount": False},
        ]
    )
    thrown_away, kept = med["existences"]

    response = client.delete(f"/existences/{thrown_away['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"/medications/{med['id']}").json()["existences"] == [kept]


def test_delete_missing_existence_is_404(client):
    response = client.delete("/existences/999999")

    assert response.status_code == 404
