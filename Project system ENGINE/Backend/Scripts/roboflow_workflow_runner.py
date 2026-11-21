#!/usr/bin/env python3
"""
ResQTrack Roboflow Serverless Workflow Runner (inference-sdk >= 1.5.0).
Executes header-authenticated Roboflow Workflows with 15-minute workflow caching
for both face detection (classes: "face") and Philippine ID detection
(classes: "driver, postal, umid", dataset: yolov8-ctdd4/philippine-ids).
Zero emojis, pure ASCII JSON output on stdout.
"""

import argparse
import json
import os
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Roboflow Serverless Workflow via inference-sdk")
    parser.add_argument("--api-url", default="https://serverless.roboflow.com")
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--workflow", required=True)
    parser.add_argument("--image", required=True)
    parser.add_argument("--classes", required=True)
    parser.add_argument("--use-cache", default="true")
    args = parser.parse_args()

    api_key = os.environ.get("ROBOFLOW_API_KEY", "").strip()
    if not api_key:
        print(json.dumps({"error": "MISSING_ROBOFLOW_API_KEY"}))
        return 2

    if not os.path.exists(args.image):
        print(json.dumps({"error": "MISSING_IMAGE_FILE"}))
        return 3

    try:
        from inference_sdk import InferenceHTTPClient, InferenceConfiguration
    except ImportError as exc:
        print(json.dumps({"error": f"INFERENCE_SDK_NOT_INSTALLED: {exc}"}))
        return 4

    use_cache_flag = str(args.use_cache).strip().lower() in ("1", "true", "yes")

    try:
        client = InferenceHTTPClient(
            api_url=args.api_url,
            api_key=api_key,
        ).configure(
            InferenceConfiguration(
                api_key_transport="header"  # header-based auth (inference v1.5.0+)
            )
        )

        result = client.run_workflow(
            workspace_name=args.workspace,
            workflow_id=args.workflow,
            images={
                "image": args.image,
            },
            parameters={
                "classes": args.classes,
            },
            use_cache=use_cache_flag,  # cache workflow definition for 15 minutes
        )

        print(json.dumps(result, default=str))
        return 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
