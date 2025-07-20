import base64
import json
import sys

# This script safely converts your Firebase service account JSON file to a Base64 string.
#
# How to use:
# 1. Make sure you have downloaded your service account JSON file from Firebase.
# 2. Run this script from your terminal, passing the path to your file as an argument:
#    python3 encode_sa.py /path/to/your/service-account-file.json
#
# The script will print the Base64 encoded string to your console.

def encode_service_account(file_path):
    try:
        with open(file_path, 'r') as f:
            # Read the file content
            service_account_json = f.read()
            
            # Ensure it's valid JSON before encoding
            json.loads(service_account_json)

            # Encode the raw JSON string to Base64
            encoded_bytes = base64.b64encode(service_account_json.encode('utf-8'))
            encoded_string = encoded_bytes.decode('utf-8')
            
            print("
✅ Success! Your Base64 encoded service account is:
")
            print(encoded_string)
            print("
Copy the string above and paste it into your .env.local file for the FIREBASE_SERVICE_ACCOUNT_BASE64 variable.")

    except FileNotFoundError:
        print(f"❌ Error: The file was not found at {file_path}")
    except json.JSONDecodeError:
        print("❌ Error: The file is not a valid JSON file.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 encode_sa.py /path/to/your/service-account-file.json")
    else:
        encode_service_account(sys.argv[1])
