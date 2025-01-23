NAVIGATE = {
    "type":"function",
    "function":{
        "name":"navigate",
        "parameters":{
            "type":"object",
            "properties":{
                "thought":{
                    "type":"string",
                    "description":"Clearly specify why you chose the specific pano, heading and pitch, explain your thought process for picking that specific navigation link"
                },
                "reasoning":{
                    "type":"string",
                    "description":"Use the generated thought and reason before you decide on the pano, heading and pitch"
                },
                "pano":{
                    "type":"string",
                    "description":"The pano id of the location to navigate to"
                },
                "heading":{
                    "type":"number",
                    "description":"The heading of the location to navigate to"
                },
                "pitch":{
                    "type":"number",
                    "description":"The pitch of the location to navigate to"
                },
                
            },
            "required":["thought","reasoning","heading","pano","pitch"]
        }
    }
}

PAN_CAMERA = {
    "type":"function",
    "function":{
        "name":"pan_camera",
        "parameters":{
            "type":"object",
            "properties":{
                 "thought":{
                    "type":"string",
                    "description":"Clearly specify why you chose the specific heading, explain your thought process for picking that specific heading"
                },
                "reasoning":{
                    "type":"string",
                    "description":"Use the generated thought and reason before you decide on the heading angle"
                },
                "heading":{
                    "type":"number",
                    "description":"heading angle to pan the camera to"
                },
              
            },
            "required":["thought","reasoning","heading"]
        }
    }
}

END= {
    "type":"function",
    "function":{
        "name":"end",
        "parameters":{
            "type":"object",
            "properties":{
                "thought":{
                    "type":"string",
                    "description":"Clearly specify why you're ending the search for location"
                }
            },
            "required":["thought","reasoning"]
        }
    }
}

SATELLITE_SNAPSHOT = {
    "type":"function",
    "function":{
        "name":"satellite_snapshot",
        "parameters":{
            "type":"object",
            "properties":{
                "lat":{
                    "type":"number",
                    "description":"The latitude of the location to take a satellite snapshot of, Mostly the current lat lng"
                },
                "lng":{
                    "type":"number",
                    "description":"The longitude of the location to take a satellite snapshot of, Mostly the current lat lng"
                }   
            },
            "required":["lat","lng"]
        }
    }
}