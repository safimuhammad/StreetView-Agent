from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import json
import base64
import os
from io import BytesIO
from PIL import Image
from agent import chat_llm, system_prompt

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Welcome to RePrompt Agent server!"}


def navigate_to_location(locations: list[dict]) -> str:
    parse_locations = json.loads(locations)
    print(parse_locations, "parse_locations")
    return parse_locations


chat_history = [{"role": "system", "content": system_prompt}]


def clean_message_for_history(message):
    """Remove base64 images from message to keep chat history smaller."""
    if not message or "content" not in message:
        return message

    if isinstance(message["content"], list):
        cleaned_content = []
        for item in message["content"]:
            if item.get("type") == "image_url":
                # Replace base64 with a placeholder
                cleaned_content.append(
                    {"type": "text", "text": "[Image snapshot was Provided]"}
                )
            else:
                cleaned_content.append(item)
        message["content"] = cleaned_content

    return message


# Ignore the print statements below, Only for debugging

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_text("Connected to WebSocket!")

    # Ensure snapshots dir exists
    os.makedirs("snapshots", exist_ok=True)

    try:
        while True:
            data_text = await websocket.receive_text()
            print("Received from client")
            try:
                msg = json.loads(data_text)
            except:
                # If it's not valid JSON, skip or handle differently
                print("Could not parse JSON from client:")
                continue

            msg_type = msg.get("type")
            print(msg_type, "msg_type")

            if msg_type == "STREETVIEW_SNAPSHOT":
                pano_id = msg.get("panoId")
                lat = msg.get("lat")
                lng = msg.get("lng")
                heading = msg.get("heading")
                pitch = msg.get("pitch")
                image_b64 = msg.get("image")
                links = msg.get("links", [])
                marker = msg.get("marker")
                user_query = msg.get("user_query")
                if image_b64 and pano_id:
                    user_message = {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"""GOAL: {user_query} /n,
                                **Always use Tools to respond** Keep Navigating and Panning Until you have a good view of the location, 
                                Provided Metadata:/n
                                Current StreetView snapshot taken from lat={lat}, lng={lng}, 
                                StreetView snapshot Started from {marker}, current heading={heading}, current pitch={pitch}, navigation links with direction={links}""",
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_b64}",
                                    "detail": "high",
                                },
                            },
                        ],
                    }
                    chat_history.append(user_message)
                    response_text = chat_llm(history=chat_history)

                    print(response_text, "response_text")

                    if isinstance(response_text, list) and len(response_text) > 0:
                        function_call = response_text[0]
                        if (
                            hasattr(function_call, "function")
                            and function_call.function.name == "navigate"
                        ):
                            try:

                                nav_args = json.loads(function_call.function.arguments)
                                nav_msg = {
                                    "type": "NAVIGATE",
                                    "pano": nav_args.get("pano"),
                                    "heading": nav_args.get("heading", 0),
                                    "pitch": nav_args.get("pitch", 0),
                                    "thought": f"{nav_args.get('thought', '')}, Reasoning: {nav_args.get('reasoning', '')}",
                                }
                                assistant_msg = {
                                    "role": "assistant",
                                    "content": [
                                        {
                                            "type": "text",
                                            "text": f"Previous Function Call for reference Only do not use for output:NAVIGATE() : {str(response_text)}",
                                        }
                                    ],
                                }
                                chat_history.append(assistant_msg)

                                await websocket.send_text(json.dumps(nav_msg))
                                # print(nav_msg, "nav_msg")
                            except Exception as e:
                                print(f"Error parsing function call: {e}")
                                nav_msg = None
                        elif (
                            hasattr(function_call, "function")
                            and function_call.function.name == "pan_camera"
                        ):
                            try:
                                print("pan_camera function call found")
                                print(function_call, "function_call")
                                pan_args = json.loads(function_call.function.arguments)
                                pan_msg = {
                                    "type": "PAN_CAMERA",
                                    "heading": pan_args.get("heading", 0),
                                    "thought": f"{pan_args.get('thought', '')}, Reasoning: {pan_args.get('reasoning', '')}",
                                }
                                assistant_msg = {
                                    "role": "assistant",
                                    "content": [
                                        {
                                            "type": "text",
                                            "text": f"Previous Function Call for **reference Only do not use for output** Function Call:PAN_CAMERA() : {str(response_text)}",
                                        }
                                    ],
                                }
                                chat_history.append(assistant_msg)
                                await websocket.send_text(json.dumps(pan_msg))
                            except Exception as e:
                                print(f"Error parsing function call: {e}")
                                pan_msg = None
                        elif (
                            hasattr(function_call, "function")
                            and function_call.function.name == "end"
                        ):
                            end_args = json.loads(function_call.function.arguments)
                            print("end function call found")
                            print(function_call, "function_call")
                            end_msg = {
                                "type": "END",
                                "thought": end_args.get("thought", ""),
                            }
                            assistant_msg = {
                                "role": "assistant",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": f"Previous Function Call for **reference Only do not use in output** Function Call:End() : {str(response_text)}",
                                    }
                                ],
                            }
                            chat_history.append(assistant_msg)
                            await websocket.send_text(json.dumps(end_msg))
                        elif (
                            hasattr(function_call, "function")
                            and function_call.function.name == "satellite_snapshot"
                        ):
                            sat_args = json.loads(function_call.function.arguments)
                            print("satellite_snapshot function call found")
                            print(function_call, "function_call")
                            sat_msg = {
                                "type": "SATELLITE_SNAPSHOT",
                                "lat": sat_args.get("lat", 0),
                                "lng": sat_args.get("lng", 0),
                            }
                            assistant_msg = {
                                "role": "assistant",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": f"Previous Taken steps  for **reference Only do not use in output** SATELLITE_SNAPSHOT() : {str(response_text)}",
                                    }
                                ],
                            }
                            chat_history.append(assistant_msg)
                            await websocket.send_text(json.dumps(sat_msg))
                    else:
                        print(
                            "Unknown message type from Agent:",
                            msg_type,
                            type(response_text),
                            response_text
                        )
                        await websocket.send_text(json.dumps({"type":"ERROR","thought":"Agent did not return any function call, please try again, with a function call, Never return plain text"}))
               

            else:
                print("Unknown message type from client:", msg_type)
    except Exception as e:
        print("WebSocket disconnected:", e)
    finally:
        await websocket.close()
