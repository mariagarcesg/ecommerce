FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 8501: dashboard Streamlit (app.py) | 8000: API FastAPI para el frontend (main.py)
EXPOSE 8501 8000

# Por defecto arranca el dashboard. Para la API:
#   uvicorn main:app --host 0.0.0.0 --port 8000
CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0", "--server.headless=true"]
