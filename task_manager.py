import threading
import subprocess

cancel_flag = threading.Event()
current_process = None
process_lock = threading.Lock()

def reset_task_state():
    global current_process
    cancel_flag.clear()
    with process_lock:
        current_process = None