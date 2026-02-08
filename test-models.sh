#!/bin/bash

# Test all providers and models through AgentGazer proxy
PROXY_URL="http://localhost:18900"

# Function to test a single model
test_model() {
  local provider=$1
  local model=$2
  local max_tokens=20

  # Anthropic needs higher max_tokens
  if [ "$provider" = "anthropic" ]; then
    max_tokens=100
  fi

  local body="{\"model\": \"$model\", \"messages\": [{\"role\": \"user\", \"content\": \"Say hello in 3 words\"}], \"max_tokens\": $max_tokens}"

  response=$(curl -s -w "\n%{http_code}" -X POST \
    "$PROXY_URL/agents/test/$provider" \
    -H "Content-Type: application/json" \
    -d "$body" \
    --max-time 30 2>&1)

  http_code=$(echo "$response" | tail -1)
  body_response=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ]; then
    echo "  ✓ $model (200 OK)"
    echo "✓ $provider/$model" >> /tmp/test-results.txt
  else
    error_msg=$(echo "$body_response" | head -c 200)
    echo "  ✗ $model ($http_code) - $error_msg"
    echo "✗ $provider/$model ($http_code)" >> /tmp/test-results.txt
  fi

  sleep 0.5
}

echo "=========================================="
echo "AgentGazer Model Test Suite"
echo "=========================================="
echo ""

# Clear previous results
> /tmp/test-results.txt

# OpenAI
echo "Testing openai..."
for model in gpt-4o gpt-4o-mini o1 o3-mini; do
  test_model openai "$model"
done
echo ""

# Anthropic
echo "Testing anthropic..."
for model in claude-opus-4-5-20251101 claude-sonnet-4-5-20250929 claude-sonnet-4-20250514 claude-haiku-4-5-20251001; do
  test_model anthropic "$model"
done
echo ""

# Google
echo "Testing google..."
for model in gemini-2.5-flash gemini-2.5-pro; do
  test_model google "$model"
done
echo ""

# Mistral
echo "Testing mistral..."
for model in mistral-large-latest mistral-small-latest codestral-latest; do
  test_model mistral "$model"
done
echo ""

# Cohere
echo "Testing cohere..."
for model in command-a-03-2025 command-r-plus-08-2024 command-r-08-2024 command-r7b-12-2024; do
  test_model cohere "$model"
done
echo ""

# DeepSeek
echo "Testing deepseek..."
for model in deepseek-chat deepseek-reasoner; do
  test_model deepseek "$model"
done
echo ""

# Moonshot
echo "Testing moonshot..."
for model in moonshot-v1-8k kimi-k2.5; do
  test_model moonshot "$model"
done
echo ""

# Zhipu
echo "Testing zhipu..."
for model in glm-4.7 glm-4.7-flash glm-4; do
  test_model zhipu "$model"
done
echo ""

# MiniMax
echo "Testing minimax..."
for model in MiniMax-M2.1 MiniMax-M2; do
  test_model minimax "$model"
done
echo ""

# Yi
echo "Testing yi..."
for model in yi-lightning yi-large; do
  test_model yi "$model"
done
echo ""

echo ""
echo "=========================================="
echo "SUMMARY"
echo "=========================================="
cat /tmp/test-results.txt
