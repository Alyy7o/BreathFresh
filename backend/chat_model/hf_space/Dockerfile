FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git git-lfs build-essential cmake \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 user
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

RUN chown -R user:user /app
USER user

ENV GRADIO_SERVER_NAME="0.0.0.0"
ENV GRADIO_SERVER_PORT="7860"
ENV HF_HOME="/app/.cache"

EXPOSE 7860
CMD ["python", "app.py"]
