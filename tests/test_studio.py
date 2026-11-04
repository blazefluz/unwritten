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
