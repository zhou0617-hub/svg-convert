import subprocess
import platform

# 匹配你的路径
if platform.system() == "Windows":
    exe = r"C:\potrace-1.16.win64\potrace.exe"
else:
    exe = "potrace"

res = subprocess.run([exe, "--version"], capture_output=True, text=True)
print("==== 执行结果 ====")
print("标准输出:", res.stdout)
print("错误输出:", res.stderr)
print("返回码(0=成功):", res.returncode)