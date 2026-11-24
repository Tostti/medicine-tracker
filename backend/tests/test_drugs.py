def test_create_drug(client):
    response = client.post("/drugs/", json={"name": "  Paracetamol "})

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Paracetamol"  # surrounding spaces are trimmed
    assert isinstance(body["id"], int)


def test_create_drug_reuses_an_existing_name_ignoring_case(client):
    first = client.post("/drugs/", json={"name": "Ibuprofeno"}).json()
    again = client.post("/drugs/", json={"name": "IBUPROFENO"}).json()

    assert again == first
    assert len(client.get("/drugs/").json()) == 1


def test_create_drug_rejects_a_blank_name(client):
    response = client.post("/drugs/", json={"name": "   "})

    assert response.status_code == 422


def test_list_drugs_is_sorted_by_name_and_paginated(client):
    for name in ["Paracetamol", "Amoxicilina", "Ibuprofeno"]:
        client.post("/drugs/", json={"name": name})

    names = [d["name"] for d in client.get("/drugs/").json()]
    assert names == ["Amoxicilina", "Ibuprofeno", "Paracetamol"]

    page = client.get("/drugs/", params={"skip": 1, "limit": 1}).json()
    assert [d["name"] for d in page] == ["Ibuprofeno"]


def test_get_drug(client):
    created = client.post("/drugs/", json={"name": "Paracetamol"}).json()

    response = client.get(f"/drugs/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_get_missing_drug_is_404(client):
    response = client.get("/drugs/999999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Drug not found"}
