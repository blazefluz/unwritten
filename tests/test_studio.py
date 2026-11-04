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
