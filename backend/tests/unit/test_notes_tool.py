import pytest
import uuid
from backend.tools.notes_tool import (
    add_note, 
    get_note, 
    notes_storage, # For clearing between tests
    ADD_NOTE_TOOL_DEFINITION,
    GET_NOTE_TOOL_DEFINITION
)
from backend.models.tool_definition import MCPToolDefinition

@pytest.fixture(autouse=True)
def clear_notes_storage_before_each_test():
    """Ensures notes_storage is empty before each test."""
    notes_storage.clear()

def test_add_note_tool_definition():
    assert isinstance(ADD_NOTE_TOOL_DEFINITION, MCPToolDefinition)
    assert ADD_NOTE_TOOL_DEFINITION.tool_name == "add_note_tool"
    assert "content" in ADD_NOTE_TOOL_DEFINITION.input_schema["properties"]
    assert "note_id" in ADD_NOTE_TOOL_DEFINITION.output_schema["properties"]
    assert ADD_NOTE_TOOL_DEFINITION.handler_identifier == "backend.tools.notes_tool:add_note"

def test_get_note_tool_definition():
    assert isinstance(GET_NOTE_TOOL_DEFINITION, MCPToolDefinition)
    assert GET_NOTE_TOOL_DEFINITION.tool_name == "get_note_tool"
    assert "note_id" in GET_NOTE_TOOL_DEFINITION.input_schema["properties"]
    assert "content" in GET_NOTE_TOOL_DEFINITION.output_schema["properties"] # Check for a key field
    assert GET_NOTE_TOOL_DEFINITION.handler_identifier == "backend.tools.notes_tool:get_note"

def test_add_note_with_title():
    content = "This is a test note with a title."
    title = "My Test Title"
    result = add_note(content=content, title=title)
    
    assert result["status"] == "success"
    assert "note_id" in result
    note_id = result["note_id"]
    
    assert note_id in notes_storage
    assert notes_storage[note_id]["content"] == content
    assert notes_storage[note_id]["title"] == title
    assert notes_storage[note_id]["id"] == note_id

def test_add_note_without_title():
    content = "This is a test note without a title."
    result = add_note(content=content) # Title is optional
    
    assert result["status"] == "success"
    assert "note_id" in result
    note_id = result["note_id"]
    
    assert note_id in notes_storage
    assert notes_storage[note_id]["content"] == content
    assert notes_storage[note_id]["title"] is None # Default title should be None
    assert notes_storage[note_id]["id"] == note_id

def test_get_existing_note():
    # First, add a note to retrieve
    content = "Content of an existing note."
    title = "Existing Note"
    add_result = add_note(content=content, title=title)
    note_id = add_result["note_id"]
    
    # Now, try to get it
    get_result = get_note(note_id=note_id)
    
    assert "error" not in get_result
    assert get_result["id"] == note_id
    assert get_result["content"] == content
    assert get_result["title"] == title

def test_get_non_existent_note():
    non_existent_id = str(uuid.uuid4()) # Generate a random UUID that won't exist
    get_result = get_note(note_id=non_existent_id)
    
    assert "error" in get_result
    assert get_result["error"] == "not found"
    assert "id" not in get_result # Should not have other fields if error

def test_add_multiple_notes():
    result1 = add_note(content="Note 1", title="Title 1")
    result2 = add_note(content="Note 2")
    
    assert result1["status"] == "success"
    assert result2["status"] == "success"
    
    note_id1 = result1["note_id"]
    note_id2 = result2["note_id"]
    
    assert note_id1 != note_id2 # IDs should be unique
    assert len(notes_storage) == 2
    
    assert notes_storage[note_id1]["title"] == "Title 1"
    assert notes_storage[note_id2]["title"] is None

def test_get_note_after_multiple_adds():
    add_note(content="First one")
    add_result_target = add_note(content="Target Note Content", title="Target Title")
    add_note(content="Third one")
    
    target_note_id = add_result_target["note_id"]
    
    retrieved_note = get_note(note_id=target_note_id)
    assert retrieved_note["content"] == "Target Note Content"
    assert retrieved_note["title"] == "Target Title"

```
