from unwritten.studio import SCHEMA, propose


def test_studio_uses_structured_meta_interface_and_preserves_context():
    class FakeClient:
        def ask_json(self, prompt, schema, name, video=None):
            assert name == "world_studio_edit"
            assert schema is SCHEMA
            assert '"selected_id": "table-1"' in prompt
            assert '"request": "Move this left"' in prompt
            assert "Never return code" in prompt
            assert "structural verification" in prompt
            assert video is None
            return {"message": "Move proposed", "actions": []}
    result = propose(FakeClient(), {"catalog": {}, "scene": {"objects": []}, "selectedId": "table-1", "prompt": "Move this left"})
    assert result == {"message": "Move proposed", "actions": []}


def test_car_proposals_use_meta_json_and_keep_dimensions_as_data():
    from unwritten.studio import CAR_SCHEMA, propose_car
    class FakeClient:
        def ask_json(self, prompt, schema, name, video=None):
            assert name == "world_studio_car"
            assert schema is CAR_SCHEMA
            assert '"request": "Make it wider"' in prompt
            assert "NOT engineering CAD" in prompt
            assert "Preserve every field" in prompt
            return {"message": "Please specify the width.", "car": None}
    assert propose_car(FakeClient(), {"car": None, "presets": {}, "prompt": "Make it wider"})["car"] is None


def test_every_scene_action_requires_a_spoken_reason():
    actions = SCHEMA["properties"]["actions"]["items"]["anyOf"]
    for kind in ("add", "update", "remove"):
        action = next(a for a in actions if a["properties"]["type"]["enum"] == [kind])
        assert "reason" in action["required"]
    lighting = next(a for a in actions if a["properties"]["type"]["enum"] == ["lighting"])
    assert "reason" not in lighting["properties"]


def test_photo_store_sends_the_photo_as_an_image_and_asks_for_designs_and_products():
    from unwritten.studio import PHOTO_SCHEMA, propose_photo
    seen = {}
    class FakeClient:
        def ask_json(self, prompt, schema, name, video=None, image=None):
            seen.update(name=name, schema=schema, image=image, prompt=prompt)
            return {"message": "Built", "name": "Shop", "observed": [], "actions": [],
                    "designs": [], "products": None}
    propose_photo(FakeClient(), {"catalog": {}, "image": "data:image/jpeg;base64,AAAA", "note": "corner shop"})
    assert seen["name"] == "world_studio_photo_store"
    assert seen["schema"] is PHOTO_SCHEMA
    assert seen["image"] == "data:image/jpeg;base64,AAAA"
    assert '"note": "corner shop"' in seen["prompt"]
    assert "Do not claim real sales" in seen["prompt"]
    for key in ("observed", "designs", "products", "actions"):
        assert key in PHOTO_SCHEMA["required"]


def test_meta_client_attaches_images_as_input_image_parts():
    from unwritten.client import MetaClient
    calls = {}
    class Responses:
        def create(self, **kwargs):
            calls.update(kwargs)
            return type("R", (), {"output_text": '{"ok": true}'})()
    client = MetaClient.__new__(MetaClient)
    client.model, client.reasoning_effort, client.max_output_tokens = "m", "low", 10
    client._client = type("C", (), {"responses": Responses()})()
    assert client.ask_json("look", {}, "n", image="data:image/png;base64,AA") == {"ok": True}
    content = calls["input"][0]["content"]
    assert content[1] == {"type": "input_image", "image_url": "data:image/png;base64,AA"}
