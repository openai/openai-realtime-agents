import pytest
from backend.tools.calculator_tool import calculate, CALCULATOR_TOOL_DEFINITION
from backend.models.tool_definition import MCPToolDefinition

def test_calculator_tool_definition():
    assert isinstance(CALCULATOR_TOOL_DEFINITION, MCPToolDefinition)
    assert CALCULATOR_TOOL_DEFINITION.tool_name == "calculator_tool"
    assert "expression" in CALCULATOR_TOOL_DEFINITION.input_schema["properties"]
    assert "result" in CALCULATOR_TOOL_DEFINITION.output_schema["properties"]
    assert CALCULATOR_TOOL_DEFINITION.handler_identifier == "backend.tools.calculator_tool:calculate"

@pytest.mark.parametrize("expression, expected_result, expected_error", [
    # Valid expressions
    ("2 + 2", 4.0, None),
    ("5 * 3", 15.0, None),
    ("10 / 2", 5.0, None),
    ("2 - 5", -3.0, None),
    ("(3 + 5) * 2", 16.0, None),
    ("100 / (2 + 3)", 20.0, None),
    ("2.5 * 4", 10.0, None),
    ("1 / 3", 1/3, None),
    ("  (  1 +   1 )   *3 ", 6.0, None), # Test with spaces
    ("((1+1)*2 + 1)*3", 15.0, None), # Nested parentheses

    # Error cases - Division by zero
    ("1 / 0", None, "Calculation result is undefined (e.g., division by zero)."),
    ("10 / (5 - 5)", None, "Calculation result is undefined (e.g., division by zero)."),
    
    # Error cases - Syntax errors
    ("3 + ", None, "Invalid syntax in expression."),
    (" ( 2 + 2 ", None, "Invalid syntax in expression."), # Mismatched parentheses
    ("2 + * 3", None, "Invalid syntax in expression."),

    # Error cases - Unsupported operations/characters (AST check or pre-filter)
    ("import os", None, "Expression contains invalid characters."), # Caught by pre-filter
    ("print('hello')", None, "Expression contains invalid characters."), # Caught by pre-filter
    ("2 ** 3", None, "Operator Pow not allowed"), # AST eval, if Pow not in ALLOWED_OPERATORS
    ("a + b", None, "Expression contains invalid characters."), # Caught by pre-filter
    ("eval('1+1')", None, "Expression contains invalid characters."), # Caught by pre-filter
    ("os.system('echo unsafe')", None, "Expression contains invalid characters."), # Caught by pre-filter
    ("1; DROP TABLE users", None, "Expression contains invalid characters."), # Caught by pre-filter
    ("foo()", None, "Expression contains invalid characters."), # Caught by pre-filter
    
    # Error cases - Type errors from _safe_eval_expr_node if AST somehow bypassed pre-filter for non-numeric constants
    # These are harder to trigger if the pre-filter is broad or AST parsing itself fails first.
    # The 'a + b' case above is more likely caught by the pre-filter for 'a' and 'b'.
])
def test_calculate_function(expression, expected_result, expected_error):
    output = calculate(expression)
    
    if expected_error:
        assert "error" in output
        assert expected_error in output["error"]
        assert "result" not in output # Should not have result if error
    else:
        assert "result" in output
        assert output["result"] == pytest.approx(expected_result)
        assert "error" not in output

def test_calculate_complex_but_safe_expression():
    # Test a more complex expression that is still within the safe limits
    expression = "((10.5 * 2) + (6 / 2) - (1.5 * 2)) / 2" # (21 + 3 - 3) / 2 = 21 / 2 = 10.5
    output = calculate(expression)
    assert "result" in output
    assert output["result"] == pytest.approx(10.5)
    assert "error" not in output

def test_calculate_disallowed_operator_explicitly():
    # This test assumes that ast.Pow is NOT in ALLOWED_OPERATORS in calculator_tool.py
    # If it is, this test needs adjustment or removal.
    expression = "2 ** 3" # Exponentiation
    output = calculate(expression)
    if "Operator Pow not allowed" in str(ALLOWED_OPERATORS): # Check if Pow is truly disallowed
         assert "error" in output
         assert "Operator Pow not allowed" in output["error"]
    else: # If Pow was added to ALLOWED_OPERATORS
        if "error" in output: # Should not error if Pow is allowed
            pytest.fail(f"Pow operator is allowed, but calculate returned error: {output['error']}")
        else:
            assert output["result"] == pytest.approx(8.0)

# Test for security against more complex AST attacks if pre-filter were bypassed
# For example, a ListComprehension or Call node if they weren't filtered by _is_safe_ast_node
def test_calculate_unsafe_ast_constructs():
    # These expressions should be caught by the _is_safe_ast_node validation
    # if they somehow pass the initial character filter (which they shouldn't for these specific examples).
    unsafe_expressions = [
        "[x for x in [1,2,3]]",  # List comprehension
        "abs(-5)", # Function call (abs is not a simple operator)
        "__import__('os').system('echo unsafe')" # More complex attack
    ]
    for expr in unsafe_expressions:
        # The pre-filter `if not all(char in "0123456789+-*/(). " for char in expression):`
        # will catch these. If we wanted to test _is_safe_ast_node more directly,
        # we'd have to mock or bypass that pre-filter.
        # Given the pre-filter, these should result in "Expression contains invalid characters."
        output = calculate(expr)
        assert "error" in output
        assert "Expression contains invalid characters." in output["error"]

```
