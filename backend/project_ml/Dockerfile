FROM python:3.11-slim

WORKDIR /app

COPY requirements-ml.txt ./requirements-ml.txt
RUN pip install --no-cache-dir -r requirements-ml.txt

COPY project_ml/ ./project_ml/

RUN mkdir -p /app/project_ml/models /app/project_ml/outputs

EXPOSE 8000

CMD python project_ml/startup.py && \
    uvicorn project_ml.api.app:app \
      --host 0.0.0.0 \
      --port 8000 \
      --workers 2 \
      --timeout-keep-alive 30
