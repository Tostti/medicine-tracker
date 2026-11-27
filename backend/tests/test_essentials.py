import pytest


@pytest.fixture
def create_essential(client):
    def _create(*drugs: tuple[str, str]) -> dict:
        response = client.post(
            "/essentials/", json={"drugs": [{"name": n, "dose": d} for n, d in drugs]}
        )
        assert response.status_code == 201, response.text
        return response.json()

    return _create


def covering(client) -> dict[str, list[str]]:
    """{first drug of each essential: names of the medications that cover it}"""
    return {
        " + ".join(d["drug"]["name"] for d in e["drugs"]): [
            m["commercial_name"] for m in e["medications"]
        ]
        for e in client.get("/essentials/").json()
    }


def test_create_and_list(client, create_essential):
    created = create_essential(("Ibuprofeno", "600 mg"))

    assert created["drugs"] == [
        {
            "dose": "600 mg",
            "drug": {"id": created["drugs"][0]["drug"]["id"], "name": "Ibuprofeno"},
        }
    ]
    assert client.get("/essentials/").json() == [{**created, "medications": []}]


def test_any_brand_with_the_same_composition_covers_it(
    client, create_essential, create_medication
):
    create_essential(("Ibuprofeno", "600 mg"))
    create_medication(
        commercial_name="Ibupirac 600", drugs=[{"name": "ibuprofeno", "dose": "600mg"}]
    )
    create_medication(
        commercial_name="Actron 600", drugs=[{"name": "Ibuprofeno", "dose": "0,6 g"}]
    )
    # Other dose, or a combination with it: not the same thing.
    create_medication(
        commercial_name="Ibupirac 400", drugs=[{"name": "Ibuprofeno", "dose": "400 mg"}]
    )
    create_medication(
        commercial_name="Ibuevanol",
        drugs=[
            {"name": "Ibuprofeno", "dose": "600 mg"},
            {"name": "Pseudoefedrina", "dose": "60 mg"},
        ],
    )

    assert covering(client) == {"Ibuprofeno": ["Actron 600", "Ibupirac 600"]}


def test_a_combination_needs_every_drug(client, create_essential, create_medication):
    create_essential(("Paracetamol", "500 mg"), ("Cafeína", "65 mg"))
    create_medication(
        commercial_name="Tafirol Plus",
        drugs=[
            {"name": "Cafeína", "dose": "65mg"},
            {"name": "Paracetamol", "dose": "500mg"},
        ],
    )
    create_medication(
        commercial_name="Tafirol", drugs=[{"name": "Paracetamol", "dose": "500 mg"}]
    )

    assert covering(client) == {"Paracetamol + Cafeína": ["Tafirol Plus"]}


def test_includes_the_stock_of_covering_medications(
    client, create_essential, create_medication
):
    create_essential(("Ibuprofeno", "600 mg"))
    create_medication(
        commercial_name="Ibupirac 600",
        drugs=[{"name": "Ibuprofeno", "dose": "600 mg"}],
        existences=[{"due_date": "2030-01-01", "low_amount": True}],
    )

    [essential] = client.get("/essentials/").json()
    assert essential["medications"][0]["existences"][0]["low_amount"] is True


def test_editing_a_dose_changes_what_it_covers(
    client, create_essential, create_medication
):
    create_essential(("Ibuprofeno", "600 mg"))
    medication = create_medication(
        commercial_name="Ibupirac", drugs=[{"name": "Ibuprofeno", "dose": "400 mg"}]
    )
    assert covering(client) == {"Ibuprofeno": []}

    client.patch(
        f"/medications/{medication['id']}",
        json={"drugs": [{"name": "Ibuprofeno", "dose": "600 mg"}]},
    )

    assert covering(client) == {"Ibuprofeno": ["Ibupirac"]}


def test_listed_by_drug_name(client, create_essential):
    create_essential(("Paracetamol", "1 g"))
    create_essential(("amoxicilina", "500 mg"))
    create_essential(("Ibuprofeno", "600 mg"))

    assert list(covering(client)) == ["amoxicilina", "Ibuprofeno", "Paracetamol"]


def test_the_same_composition_twice_is_a_conflict(client, create_essential):
    create_essential(("Ibuprofeno", "600 mg"))

    response = client.post(
        "/essentials/", json={"drugs": [{"name": "IBUPROFENO", "dose": "0.6g"}]}
    )

    assert response.status_code == 409
    assert len(client.get("/essentials/").json()) == 1


def test_needs_at_least_one_drug(client):
    assert client.post("/essentials/", json={"drugs": []}).status_code == 422


def test_unknown_drug_id_saves_nothing(client):
    response = client.post(
        "/essentials/",
        json={
            "drugs": [
                {"name": "Brand new", "dose": "1 mg"},
                {"drug_id": 999999, "dose": "1 mg"},
            ]
        },
    )

    assert response.status_code == 422
    assert client.get("/essentials/").json() == []
    # The drug created by name was rolled back with it.
    assert client.get("/drugs/").json() == []


def test_delete(client, create_essential, create_medication):
    essential = create_essential(("Ibuprofeno", "600 mg"))
    create_medication(drugs=[{"name": "Ibuprofeno", "dose": "600 mg"}])

    assert client.delete(f"/essentials/{essential['id']}").status_code == 204
    assert client.get("/essentials/").json() == []
    # Only the essential: the medication and the drug stay.
    assert len(client.get("/medications/").json()) == 1
    assert client.delete(f"/essentials/{essential['id']}").status_code == 404
