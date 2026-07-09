$env:FLAGS_enable_pir_api="0"
$env:FLAGS_use_mkldnn="0"
$env:PADDLE_DISABLE_MKLDNN="1"
.\.venv\Scripts\Activate.ps1
uvicorn main:app --port 8000 --host 0.0.0.0
