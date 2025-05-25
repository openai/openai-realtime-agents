import re
from backend.models.tool_definition import MCPToolDefinition

# Allowed characters: digits, operators (+, -, *, /), parentheses, and whitespace.
ALLOWED_EXPRESSION_PATTERN = re.compile(r"^[0-9\s\.\+\-\*\/\(\)]+$")
# More restrictive: ensure no consecutive operators, proper parentheses balancing, etc.
# For simplicity, we'll stick to character validation and rely on eval's parsing for structure.
# A full parser would be safer for complex, untrusted inputs.

def calculate(expression: str) -> dict:
    """
    Calculates the result of a simple arithmetic expression.
    Input: A simple arithmetic expression string (e.g., "2 + 2", "5 * 3").
    Output: {"result": <calculated_value>} or {"error": "<error_message>"}.
    Uses eval() after basic validation.
    """
    print(f"calculator_tool: Evaluating expression '{expression}'")

    if not isinstance(expression, str):
        return {"error": "Invalid input type. Expression must be a string."}

    if not ALLOWED_EXPRESSION_PATTERN.match(expression):
        return {"error": "Invalid characters in expression. Only numbers, operators (+, -, *, /), parentheses, and spaces are allowed."}

    # Security check: prevent expressions that might be harmful if eval is too permissive
    # (e.g. function calls, attribute access). The regex helps, but this is an extra layer.
    # This is still not foolproof for a truly sandboxed eval. A proper parser is better.
    if any(keyword in expression for keyword in ['import', 'eval', 'exec', 'lambda', '__']):
        return {"error": "Potentially unsafe expression detected."}
        
    try:
        # Using a restricted globals/locals dict for eval, though its protection is limited.
        result = eval(expression, {"__builtins__": {}}, {})
        if not isinstance(result, (int, float)):
             return {"error": "Expression did not evaluate to a number."}
        return {"result": result}
    except ZeroDivisionError:
        return {"error": "Division by zero."}
    except SyntaxError as e:
        return {"error": f"Syntax error in expression: {e}"}
    except Exception as e:
        # Catch any other errors during evaluation.
        return {"error": f"Error evaluating expression: {str(e)}"}

# --- Tool Definition ---
CALCULATOR_TOOL_DEFINITION = MCPToolDefinition(
    tool_name="calculator_tool",
    description="Calculates the result of a simple arithmetic expression (e.g., '2+2', '10*5/2', '(3+5)*2'). Supports addition, subtraction, multiplication, division, and parentheses.",
    input_schema={
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "The arithmetic expression to evaluate. Example: '2 * (3 + 5)'"
            }
        },
        "required": ["expression"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "result": {"type": "number", "description": "The numerical result of the calculation."},
            "error": {"type": "string", "description": "An error message if the calculation failed."}
        },
        # Either result or error should be present
    },
    handler_type="python_function",
    handler_identifier="backend.tools.calculator_tool:calculate"
)

if __name__ == '__main__':
    print("Calculator Tool Tests:")
    print(f"2 + 2 = {calculate('2 + 2')}")
    print(f"10 * 5 / 2 = {calculate('10 * 5 / 2')}")
    print(f"(3 + 5) * 2 = {calculate('(3 + 5) * 2')}")
    print(f"2.5 * 4 = {calculate('2.5 * 4')}")
    print(f"10 / 0 = {calculate('10 / 0')}") # Zero division
    print(f"10 / (2-2) = {calculate('10 / (2-2)')}") # Zero division via expression
    print(f"2 + = {calculate('2 +')}") # Syntax error
    print(f"import os = {calculate('import os')}") # Invalid characters/unsafe
    print(f"eval('1+1') = {calculate('eval(\"1+1\")')}") # Invalid characters/unsafe
    print(f"__import__('os').system('echo unsafe') = {calculate(\"__import__('os').system('echo unsafe')\")}") # Invalid characters/unsafe
    print(f"10 + sum([1,2]) = {calculate('10 + sum([1,2])')}") # Functions not allowed by default restricted eval

    print("\nTool Definition:")
    print(CALCULATOR_TOOL_DEFINITION.json(indent=2))
