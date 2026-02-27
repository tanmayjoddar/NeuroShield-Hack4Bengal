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
            ml_request["features"][0] = float(ml_request.get("transaction_value", 0.0))
            ml_request["features"][1] = float(ml_request.get("gas_price", 20.0))

            # Forward the formatted request to the external API
            # Use a longer timeout for the external API (30 seconds)
            # This is because the free tier of Render can be slow to start up
            try:
                # Try with a shorter timeout first for better UX
                print(f"Attempting ML risk assessment with 10s timeout")
                response = requests.post(
                    self.api_url,
                    headers={"Content-Type": "application/json"},
                    json=ml_request,
                    timeout=10  # Start with shorter timeout
                )
                print(f"ML API responded with status {response.status_code}")
            except requests.exceptions.Timeout:
                try:
                    # If that times out, try again with a longer timeout
                    print(f"First attempt timed out, retrying with 20s timeout")
                    response = requests.post(
                        self.api_url,
                        headers={"Content-Type": "application/json"},
                        json=ml_request,
                        timeout=20  # Extended timeout on retry
                    )
                    print(f"Second attempt ML API responded with status {response.status_code}")
                except requests.exceptions.Timeout:
                    # Fallback in case of timeout - log the timeout and return a default response
                    print(f"Warning: ML API request timed out after retries")

                    # Create a smart fallback based on transaction data
                    risk_level = "MEDIUM-LOW"
                    risk_score = 0.3
                    explanation = "ML API timed out. Using fallback risk assessment."

                    # If it's a contract interaction, slightly higher risk
                    if ml_request.get("is_contract_interaction", False):
                        risk_score = 0.45
                        risk_level = "MEDIUM"
                        explanation += " Contract interaction detected."

                    # If it's a large transaction, slightly higher risk
                    if ml_request.get("transaction_value", 0) > 10:
                        risk_score = min(0.6, risk_score + 0.15)
                        risk_level = "MEDIUM-HIGH"
                        explanation += " Large transaction value."

                    return {
                        "prediction": "Unknown",
                        "risk_score": risk_score,
                        "risk_level": risk_level,
                        "explanation": explanation,
                        "timeout": True,
                        "fallback_assessment": True
                    }
                except requests.exceptions.RequestException as e:
                    # Handle any other request exception
                    print(f"ML API request failed: {str(e)}")
                    return {
                        "error": f"ML API Error: {str(e)}",
                        "risk_score": 0.5,
                        "risk_level": "MEDIUM",
                        "explanation": "ML service connection error. Using cautious assessment.",
                        "error_type": str(type(e).__name__)
                    }
            except requests.exceptions.RequestException as e:
                # Handle any request exception on first attempt
                print(f"ML API request failed: {str(e)}")
                return {
                    "error": f"ML API Error: {str(e)}",
                    "risk_score": 0.5,
                    "risk_level": "MEDIUM",
                    "explanation": "ML service connection error. Using cautious assessment.",
                    "error_type": str(type(e).__name__)
                }

            # If successful, return the API response along with risk score
            if response.status_code == 200:
                try:
                    api_response = response.json()
                    # Convert the external API response to our risk score format
                    risk_score = api_response.get("risk_score", 0.1)  # Get risk score or use default

                    # Determine risk level based on risk score
                    if risk_score > 0.7:
                        risk_level = "HIGH"
                    elif risk_score > 0.4:
                        risk_level = "MEDIUM"
                    else:
                        risk_level = "LOW"

                    return {
                        "prediction": api_response.get("prediction", 0),
                        "risk_score": risk_score,
                        "risk_level": risk_level,
                        "features": api_response.get("features", []),
                        "explanation": f"Transaction risk score: {risk_score}",
                        "success": True
                    }
                except ValueError as e:
                    # JSON parsing error
                    print(f"Error parsing ML API response: {str(e)}")
                    return {
                        "error": "Invalid response from ML API (JSON parsing error)",
                        "risk_score": 0.5,
                        "risk_level": "MEDIUM",
                        "explanation": "ML service returned an invalid response. Using cautious assessment."
                    }
            else:
                # Return error information
                try:
                    error_text = response.text
                except:
                    error_text = "Could not retrieve error details"

                print(f"ML API error response: {response.status_code}, {error_text}")
                return {
                    "error": f"API Error: {response.status_code}",
                    "risk_score": 0.5,
                    "risk_level": "MEDIUM",
                    "explanation": f"ML service error (HTTP {response.status_code}). Using cautious assessment."
                }
        except Exception as e:
            # Handle any uncaught exception
            print(f"Unexpected error in ML risk assessment: {str(e)}")
            return {
                "error": f"Unexpected error: {str(e)}",
                "risk_score": 0.5,
                "risk_level": "MEDIUM",
                "explanation": "An unexpected error occurred. Using cautious assessment.",
                "error_type": str(type(e).__name__)
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
