import uuid
from backend.models.tool_definition import MCPToolDefinition

# In-memory storage for notes
notes_storage: dict = {}

def add_note(content: str, title: str = None) -> dict:
    """
    Adds a new note with content and an optional title to in-memory storage.
    """
    note_id = str(uuid.uuid4())
    notes_storage[note_id] = {"title": title, "content": content, "id": note_id}
    print(f"notes_tool: Added note ID {note_id} with title '{title}'. Current notes: {len(notes_storage)}")
    return {"note_id": note_id, "status": "success"}

def get_note(note_id: str) -> dict:
    """
    Retrieves an existing note by its ID from in-memory storage.
    """
    note = notes_storage.get(note_id)
    if note:
        print(f"notes_tool: Retrieved note ID {note_id}.")
        return note # Returns the full note object including id, title, content
    else:
        print(f"notes_tool: Note ID {note_id} not found.")
        return {"error": "not found"}

# --- Tool Definitions ---

ADD_NOTE_TOOL_DEFINITION = MCPToolDefinition(
    tool_name="add_note_tool",
    description="Adds a new note with content and an optional title. Returns the ID of the newly created note.",
    input_schema={
        "type": "object",
        "properties": {
            "content": {"type": "string", "description": "The main content of the note."},
            "title": {"type": "string", "description": "An optional title for the note."}
        },
        "required": ["content"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "note_id": {"type": "string", "description": "The unique ID of the created note."},
            "status": {"type": "string", "enum": ["success"]}
        },
        "required": ["note_id", "status"]
    },
    handler_type="python_function",
    handler_identifier="backend.tools.notes_tool:add_note"
)

GET_NOTE_TOOL_DEFINITION = MCPToolDefinition(
    tool_name="get_note_tool",
    description="Retrieves an existing note by its unique ID.",
    input_schema={
        "type": "object",
        "properties": {
            "note_id": {"type": "string", "description": "The unique ID of the note to retrieve."}
        },
        "required": ["note_id"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "id": {"type": "string", "description": "The ID of the note."},
            "title": {"type": ["string", "null"], "description": "The title of the note, if it has one."},
            "content": {"type": "string", "description": "The content of the note."},
            "error": {"type": "string", "description": "An error message if the note was not found."}
        }
        # Note: If error is present, other fields might be absent.
        # Consider a more complex schema using oneOf if strict validation of this is needed.
    },
    handler_type="python_function",
    handler_identifier="backend.tools.notes_tool:get_note"
)

if __name__ == '__main__':
    # Test cases
    print("--- Testing Notes Tool ---")
    
    # Add a note
    add_result1 = add_note(content="This is my first test note.", title="Test Note 1")
    print(f"Add Note 1: {add_result1}")
    note_id1 = add_result1.get("note_id")
    
    add_result2 = add_note(content="This is a second note without a title.")
    print(f"Add Note 2: {add_result2}")
    note_id2 = add_result2.get("note_id")

    # Get notes
    if note_id1:
        get_result1 = get_note(note_id=note_id1)
        print(f"Get Note ID {note_id1}: {get_result1}")
    
    if note_id2:
        get_result2 = get_note(note_id=note_id2)
        print(f"Get Note ID {note_id2}: {get_result2}")

    # Get a non-existent note
    non_existent_id = "non-existent-uuid"
    get_result_non_existent = get_note(note_id=non_existent_id)
    print(f"Get Note ID {non_existent_id}: {get_result_non_existent}")

    print("\nTool Definitions:")
    print("ADD_NOTE_TOOL_DEFINITION:")
    print(ADD_NOTE_TOOL_DEFINITION.json(indent=2))
    print("\nGET_NOTE_TOOL_DEFINITION:")
    print(GET_NOTE_TOOL_DEFINITION.json(indent=2))

    print(f"\nCurrent notes_storage: {notes_storage}")
