# [Layer: Backend/Scripts]
# Responsibility: Roboflow Serverless HTTP Inference SDK Bridge for accident-and-non-accident-label-image-dataset/14.
# Uses header-based authentication (api_key_transport="header") so the API key never appears in URL query parameters.

from inference_sdk import InferenceHTTPClient, InferenceConfiguration
import argparse
import os
import sys
import json


def run_roboflow_inference(image_path: str, model_id: str = "accident-and-non-accident-label-image-dataset/14") -> dict:
    api_key = os.environ.get("ROBOFLOW_API_KEY", "").strip()
    if not api_key:
        return {"error": "ROBOFLOW_API_KEY_NOT_CONFIGURED", "model_id": model_id}
    client = InferenceHTTPClient(
        api_url="https://serverless.roboflow.com",
        api_key=api_key
    ).configure(InferenceConfiguration(
        api_key_transport="header"  # header-based auth (inference v1.5.0+), never in query string
    ))
    return client.infer(image_path, model_id=model_id)


def main() -> int:
    parser = argparse.ArgumentParser(description="Roboflow accident-and-non-accident-label-image-dataset/14 inference CLI")
    parser.add_argument("--image", required=True, help="Path to the incident image file")
    parser.add_argument(
        "--model-id",
        default="accident-and-non-accident-label-image-dataset/14",
        help="Roboflow Serverless model identifier"
    )
    args = parser.parse_args()

    result = run_roboflow_inference(args.image, model_id=args.model_id)
    sys.stdout.write(json.dumps(result))
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
