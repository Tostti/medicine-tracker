from datetime import date, timedelta

import pytest

TODAY = date.today()
YESTERDAY = (TODAY - timedelta(days=1)).isoformat()
NEXT_MONTH = (TODAY + timedelta(days=30)).isoformat()
NEXT_YEAR = (TODAY + timedelta(days=365)).isoformat()

UPLOADED_KEY = "medications/" + "a" * 32 + ".webp"


def drug_names(medication: dict) -> list[str]:
    return sorted(d["drug"]["name"] for d in medication["drugs"])


# --- Create ---


def test_create_medication_with_new_drugs_and_stock(client):
    response = client.post(
        "/medications/",
        json={
            "commercial_name": "Tafirol Plus",
            "type": "Tablets",
            "function": "Painkiller",
            "common_use": True,
            "drugs": [
                {"name": "Paracetamol", "dose": "500 mg"},
                {"name": "Cafeína", "dose": "65 mg"},
            ],
            "existences": [
                {"due_date": NEXT_YEAR, "low_amount": False},
                {"due_date": NEXT_MONTH, "low_amount": True},
            ],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["commercial_name"] == "Tafirol Plus"
    assert body["common_use"] is True
    assert body["picture_uri"] is None
    assert drug_names(body) == ["Cafeína", "Paracetamol"]
    # Returned sorted by due date, whatever the order they were sent in.
    assert [e["due_date"] for e in body["existences"]] == [NEXT_MONTH, NEXT_YEAR]
    # The new drugs are real drugs now.
    assert sorted(d["name"] for d in client.get("/drugs/").json()) == [
        "Cafeína",
        "Paracetamol",
    ]


def test_create_medication_defaults(create_medication):
    body = create_medication(commercial_name="Plain")

    assert body["type"] is None
    assert body["function"] is None
    assert body["common_use"] is False
    assert body["existences"] == []


def test_create_medication_reuses_drugs_by_id_and_by_name(client, create_medication):
    drug = client.post("/drugs/", json={"name": "Ibuprofeno"}).json()

    by_id = create_medication(drugs=[{"drug_id": drug["id"], "dose": "400 mg"}])
    by_name = create_medication(drugs=[{"name": "ibuprofeno", "dose": "600 mg"}])

    assert by_id["drugs"][0]["drug"] == drug
    assert by_name["drugs"][0]["drug"] == drug  # same drug, despite the different case
    assert len(client.get("/drugs/").json()) == 1


def test_create_medication_with_an_unknown_drug_saves_nothing(client):
    response = client.post(
        "/medications/",
        json={
            "commercial_name": "Broken",
            "drugs": [
                {"name": "Brand new drug", "dose": "1 mg"},
                {"drug_id": 999999, "dose": "1 mg"},
            ],
        },
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Drug 999999 not found"}
    # The drug created by name in the same request was rolled back with the rest.
    assert client.get("/drugs/").json() == []
    assert client.get("/medications/").json() == []


def test_create_medication_rejects_a_repeated_drug(client):
    response = client.post(
        "/medications/",
        json={
            "commercial_name": "Twice",
            "drugs": [
                {"name": "Paracetamol", "dose": "500 mg"},
                {"name": "PARACETAMOL", "dose": "1 g"},
            ],
        },
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Drug 'Paracetamol' is listed twice"}
    assert client.get("/drugs/").json() == []


@pytest.mark.parametrize(
    "drug",
    [
        {"dose": "1 mg"},  # neither
        {"drug_id": 1, "name": "Paracetamol", "dose": "1 mg"},  # both
        {"name": "   ", "dose": "1 mg"},  # a blank name counts as none
    ],
)
def test_create_medication_needs_exactly_one_of_drug_id_or_name(client, drug):
    response = client.post(
        "/medications/", json={"commercial_name": "X", "drugs": [drug]}
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "picture_uri",
    ["https://example.com/box.jpg", "http://example.com/box.jpg", UPLOADED_KEY],
)
def test_create_medication_accepts_urls_and_uploaded_keys(
    create_medication, picture_uri
):
    assert create_medication(picture_uri=picture_uri)["picture_uri"] == picture_uri


@pytest.mark.parametrize(
    "picture_uri",
    [
        "box.jpg",
        "ftp://example.com/box.jpg",
        "medications/../secret.webp",
        "medications/abc.webp",
    ],
)
def test_create_medication_rejects_other_picture_uris(client, picture_uri):
    response = client.post(
        "/medications/",
        json={"commercial_name": "X", "drugs": [], "picture_uri": picture_uri},
    )

    assert response.status_code == 422


# --- Read ---


def test_get_medication(client, create_medication):
    created = create_medication(
        existences=[{"due_date": NEXT_YEAR, "low_amount": False}]
    )

    response = client.get(f"/medications/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_get_missing_medication_is_404(client):
    response = client.get("/medications/999999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Medication not found"}


def test_list_medications_is_ordered_by_id_and_paginated(client, create_medication):
    ids = [create_medication(commercial_name=f"Med {i}")["id"] for i in range(3)]

    assert [m["id"] for m in client.get("/medications/").json()] == ids
    page = client.get("/medications/", params={"skip": 1, "limit": 1}).json()
    assert [m["id"] for m in page] == [ids[1]]


@pytest.mark.parametrize(
    ("sort", "expected"),
    [
        ("id", ["banana", "Álgido", "Cebra", "aguja", "Cebra"]),
        # Ignoring case and accents; the two "Cebra" stay in the order they were added.
        ("name", ["aguja", "Álgido", "banana", "Cebra", "Cebra"]),
        ("newest", ["Cebra", "aguja", "Cebra", "Álgido", "banana"]),
    ],
)
def test_list_medications_sorted(client, create_medication, sort, expected):
    for name in ["banana", "Álgido", "Cebra", "aguja", "Cebra"]:
        create_medication(commercial_name=name)

    names = [m["commercial_name"] for m in client.get("/medications/", params={"sort": sort}).json()]
    assert names == expected


def test_sorted_pages_neither_repeat_nor_skip(client, create_medication):
    ids = [create_medication(commercial_name="Same name")["id"] for _ in range(5)]

    pages = [
        client.get("/medications/", params={"sort": "name", "skip": skip, "limit": 2}).json()
        for skip in (0, 2, 4)
    ]
    assert [m["id"] for page in pages for m in page] == ids


def test_list_medications_rejects_an_unknown_sort(client):
    response = client.get("/medications/", params={"sort": "commercial_name; DROP TABLE"})
    assert response.status_code == 422


# --- Search and filters ---


@pytest.fixture
def catalog(create_medication) -> dict[str, int]:
    """A few medications to search through, by name -> id."""
    meds = [
        create_medication(
            commercial_name="Tafirol",
            type="Comprimidos",
            function="Analgésico",
            drugs=[{"name": "Paracetamol", "dose": "500 mg"}],
            common_use=True,
            existences=[{"due_date": NEXT_YEAR, "low_amount": False}],
        ),
        create_medication(
            commercial_name="Ibupirac",
            type="Jarabe",
            function="Antiinflamatorio",
            drugs=[{"name": "Ibuprofeno", "dose": "2 %"}],
            existences=[{"due_date": YESTERDAY, "low_amount": False}],
        ),
        create_medication(
            commercial_name="Amoxidal 100% natural_",
            type="Cápsulas",
            function="Antibiótico",
            drugs=[{"name": "Amoxicilina", "dose": "500 mg"}],
        ),
    ]
    return {m["commercial_name"]: m["id"] for m in meds}


def search(client, **params) -> list[str]:
    response = client.get("/medications/", params=params)
    assert response.status_code == 200
    return [m["commercial_name"] for m in response.json()]


@pytest.mark.parametrize(
    ("q", "expected"),
    [
        ("tafi", ["Tafirol"]),  # name, case-insensitive
        ("jarabe", ["Ibupirac"]),  # type
        ("analgesico", ["Tafirol"]),  # function, without the accent
        ("ANTIBIÓTICO", ["Amoxidal 100% natural_"]),  # with the accent, upper case
        ("ibuprof", ["Ibupirac"]),  # a drug's name
        ("anti", ["Ibupirac", "Amoxidal 100% natural_"]),  # several matches
        ("nothing like this", []),
    ],
)
def test_search_by_q(client, catalog, q, expected):
    assert search(client, q=q) == expected


@pytest.mark.parametrize("q", ["%", "_", "0%", "l_"])
def test_search_treats_wildcards_literally(client, catalog, q):
    # Unescaped, "%" and "_" would match everything.
    assert search(client, q=q) == ["Amoxidal 100% natural_"]


def test_filter_by_drug(client, catalog):
    assert search(client, drug="PARACET") == ["Tafirol"]
    # Only drugs: "Jarabe" is a type, not a drug.
    assert search(client, drug="jarabe") == []


def test_filter_by_function(client, catalog):
    assert search(client, function="antiinflamatorio") == ["Ibupirac"]


def test_filter_in_stock_ignores_expired_stock(client, catalog):
    assert search(client, in_stock=True) == ["Tafirol"]


def test_filter_by_common_use(client, catalog):
    assert search(client, common_use=True) == ["Tafirol"]
    assert search(client, common_use=False) == ["Ibupirac", "Amoxidal 100% natural_"]


def test_filters_combine(client, catalog):
    assert search(client, q="a", in_stock=True, common_use=True) == ["Tafirol"]
    assert search(client, q="ibu", common_use=True) == []


# --- Update ---


def test_update_only_changes_the_fields_sent(client, create_medication):
    created = create_medication(type="Tablets", function="Painkiller", common_use=True)

    response = client.patch(
        f"/medications/{created['id']}", json={"commercial_name": "Renamed"}
    )

    assert response.status_code == 200
    assert response.json() == {**created, "commercial_name": "Renamed"}


def test_update_can_clear_optional_fields(client, create_medication):
    created = create_medication(type="Tablets", picture_uri="https://example.com/a.jpg")

    body = client.patch(
        f"/medications/{created['id']}", json={"type": None, "picture_uri": None}
    ).json()

    assert body["type"] is None
    assert body["picture_uri"] is None


@pytest.mark.parametrize("field", ["commercial_name", "common_use", "drugs"])
def test_update_rejects_null_for_required_fields(client, create_medication, field):
    created = create_medication()

    response = client.patch(f"/medications/{created['id']}", json={field: None})

    assert response.status_code == 422


def test_update_rejects_an_invalid_picture_uri(client, create_medication):
    created = create_medication()

    response = client.patch(
        f"/medications/{created['id']}", json={"picture_uri": "box.jpg"}
    )

    assert response.status_code == 422


def test_update_replaces_the_drug_list(client, create_medication):
    created = create_medication(
        drugs=[
            {"name": "Paracetamol", "dose": "500 mg"},
            {"name": "Cafeína", "dose": "65 mg"},
        ]
    )

    body = client.patch(
        f"/medications/{created['id']}",
        json={
            "drugs": [
                {"name": "paracetamol", "dose": "1 g"},  # stays, with a new dose
                {"name": "Ibuprofeno", "dose": "400 mg"},  # new
            ]
        },
    ).json()

    assert {d["drug"]["name"]: d["dose"] for d in body["drugs"]} == {
        "Paracetamol": "1 g",
        "Ibuprofeno": "400 mg",
    }
    # The removed drug is detached from the medication, but still exists.
    assert "Cafeína" in [d["name"] for d in client.get("/drugs/").json()]


def test_update_can_remove_every_drug(client, create_medication):
    created = create_medication()

    body = client.patch(f"/medications/{created['id']}", json={"drugs": []}).json()

    assert body["drugs"] == []


def test_update_with_an_unknown_drug_changes_nothing(client, create_medication):
    created = create_medication()

    response = client.patch(
        f"/medications/{created['id']}",
        json={
            "commercial_name": "Renamed",
            "drugs": [{"drug_id": 999999, "dose": "1 mg"}],
        },
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Drug 999999 not found"}
    assert client.get(f"/medications/{created['id']}").json() == created


def test_update_missing_medication_is_404(client):
    response = client.patch("/medications/999999", json={"commercial_name": "X"})

    assert response.status_code == 404


# --- Stock of a medication ---


def test_add_and_list_existences(client, create_medication):
    med = create_medication()

    later = client.post(
        f"/medications/{med['id']}/existences",
        json={"due_date": NEXT_YEAR, "low_amount": False},
    )
    sooner = client.post(
        f"/medications/{med['id']}/existences",
        json={"due_date": NEXT_MONTH, "low_amount": True},
    )

    assert later.status_code == sooner.status_code == 201
    assert sooner.json() == {
        "id": sooner.json()["id"],
        "due_date": NEXT_MONTH,
        "low_amount": True,
    }

    listed = client.get(f"/medications/{med['id']}/existences").json()
    assert listed == [sooner.json(), later.json()]  # sorted by due date
    assert client.get(f"/medications/{med['id']}").json()["existences"] == listed


def test_existences_are_listed_per_medication(client, create_medication):
    mine = create_medication(existences=[{"due_date": NEXT_YEAR, "low_amount": False}])
    create_medication(existences=[{"due_date": NEXT_MONTH, "low_amount": False}])

    listed = client.get(f"/medications/{mine['id']}/existences").json()

    assert [e["due_date"] for e in listed] == [NEXT_YEAR]


def test_add_existence_to_missing_medication_is_404(client):
    response = client.post(
        "/medications/999999/existences",
        json={"due_date": NEXT_YEAR, "low_amount": False},
    )

    assert response.status_code == 404


@pytest.mark.parametrize(
    "payload",
    [
        {"low_amount": False},
        {"due_date": "not a date", "low_amount": False},
        {"due_date": NEXT_YEAR},
    ],
)
def test_add_existence_validates_the_payload(client, create_medication, payload):
    med = create_medication()

    response = client.post(f"/medications/{med['id']}/existences", json=payload)

    assert response.status_code == 422
