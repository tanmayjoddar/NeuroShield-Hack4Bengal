import json
from http.server import BaseHTTPRequestHandler
import requests

# External ML API endpoint - hardcoded since we will only use this one
EXTERNAL_ML_API = "https://ml-fraud-transaction-detection.onrender.com/predict"

class TransactionPredictor:
    def __init__(self):
        self.api_url = EXTERNAL_ML_API

    def predict(self, transaction_data):
        """
        Predict risk score for a transaction using external ML API
        Formats the data for the external API and returns the prediction
        """
        try:
            # Check if request already has the correct format for the external ML API
            if all(k in transaction_data for k in ["from_address", "to_address", "transaction_value", "features"]):
                ml_request = transaction_data
            else:
                # Convert from old format to new format
                ml_request = {
                    "from_address": transaction_data.get("from_address", ""),
                    "to_address": transaction_data.get("to_address", ""),
                    "transaction_value": float(transaction_data.get("transaction_value", transaction_data.get("value", 0.0))),
                    "gas_price": float(transaction_data.get("gas_price", 20.0)),
                    "is_contract_interaction": bool(transaction_data.get("is_contract_interaction", transaction_data.get("is_contract", False))),
                    "acc_holder": transaction_data.get("acc_holder", transaction_data.get("from_address", "")),
                    "features": transaction_data.get("features", [0.0] * 16 + ["", ""])  # 16 floats + 2 strings
                }

            # Ensure features is correct length
            if len(ml_request["features"]) != 18:
                ml_request["features"] = [0.0] * 16 + ["", ""]

            # Make sure transaction value and gas price are in the features array
            ml_request["features"][13] = float(ml_request.get("transaction_value", 0.0))
            ml_request["features"][14] = float(ml_request.get("gas_price", 20.0))
              # Forward the formatted request to the external API
            # Use a longer timeout for the external API (30 seconds)
            # This is because the free tier of Render can be slow to start up
            try:
                response = requests.post(
                    self.api_url,
                    headers={"Content-Type": "application/json"},
                    json=ml_request,
                    timeout=30  # Extended timeout for slow Render free tier startup
                )
            except requests.exceptions.Timeout:
                # Fallback in case of timeout - log the timeout and return a default response
                print(f"Warning: ML API request timed out after 30 seconds")
                return {
                    "prediction": "Unknown",
                    "risk_score": 0.3,  # Medium-low risk for timeout cases
                    "risk_level": "MEDIUM-LOW",
                    "explanation": "ML API timed out. Using fallback risk assessment.",
                    "timeout": True
                }

            # If successful, return the API response along with risk score
            if response.status_code == 200:
                api_response = response.json()
                # Convert the external API response to our risk score format
                risk_score = 0.1  # Default low risk
                if api_response.get("prediction") == "Fraud":
                    risk_score = 0.9  # High risk
                    risk_level = "HIGH"
                else:
                    risk_level = "LOW"

                return {
                    "external_prediction": api_response,
                    "prediction": api_response.get("prediction", "Unknown"),
                    "type": api_response.get("Type", "Unknown"),
                    "risk_score": risk_score,
                    "risk_level": risk_level,
                    "explanation": f"Transaction prediction: {api_response.get('prediction', 'Unknown')}, Type: {api_response.get('Type', 'Unknown')}"
                }
            else:
                # Return error information
                return {
                    "error": f"API Error: {response.status_code}",
                    "risk_score": 0.5,
                    "risk_level": "MEDIUM",
                    "factors": ["External ML API unavailable"]
                }
        except Exception as e:
            # Handle any exception
            return {
                "error": f"Connection Error: {str(e)}",
                "risk_score": 0.5,
                "risk_level": "MEDIUM",
                "factors": ["Failed to connect to external ML API"]
            }

# Initialize the predictor
predictor = TransactionPredictor()

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.end_headers()

        try:
            # Parse transaction data
            tx_data = json.loads(post_data)

            # Get prediction from external ML API
            prediction = predictor.predict(tx_data)

            # Return prediction
            self.wfile.write(json.dumps(prediction).encode())
        except Exception as e:
            error_response = {
                "error": "Prediction error",
                "details": str(e)
            }
            self.wfile.write(json.dumps(error_response).encode())
