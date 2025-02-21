from flask import Flask, request, jsonify
import openai  # Using OpenAI model for reasoning
import os
from dotenv import load_dotenv
from openai import OpenAI
# Load environment variables
load_dotenv()

app = Flask(__name__)

@app.route("/reason", methods=["POST"])
def reason():
    try:
        data = request.get_json()
        if not data or "query" not in data:
            return jsonify({"error": "Missing 'query' in request"}), 400

        query = data["query"]
        openai.api_key = os.getenv("OPENAI_API_KEY")  # Use API key from environment
        client = OpenAI()
        response = client.chat.completions.create(
            model="o1-mini",
            messages=[
                {"role": "developer", "content": "You are a helpful assistant."},
                {"role": "user", "content": query}
            ]
            max_completion_tokens=150
        )

        return jsonify({"response": response.choices[0].message.content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
