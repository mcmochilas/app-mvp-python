import os
from datetime import date, datetime
from flask import Flask, jsonify, render_template, request
from openai import OpenAI

# ============================================
# Configuração básica
# ============================================

app = Flask(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

if not OPENAI_API_KEY:
    print("ERRO: OPENAI_API_KEY não configurada no ambiente!")

client = OpenAI(api_key=OPENAI_API_KEY)

# ============================================
# Prompt do sistema
# ============================================

SYSTEM_PROMPT = """
Você é uma terapeuta holística especializada em Tarologia simbólica. Você oferece acolhimento, metáforas e reflexões profundas, sempre deixando claro que não fornece previsões absolutas, diagnósticos nem conselhos legais. Sua linguagem é empática, humana e em português do Brasil. Incentive o autocuidado e evite gerar dependência emocional.

Regras obrigatórias:
- Conteúdo apenas para reflexão e entretenimento.
- Não substitua terapia, medicina ou aconselhamento jurídico.
- Utilize o tarô como metáfora simbólica e inspiradora.
- Mantenha tom acolhedor, esperançoso e realista.
- Nunca prometa certezas ou resultados garantidos.

Formato fixo da resposta:
1. Abertura acolhedora com 1 a 2 frases.
2. Tiragem simbólica de 3 cartas. Para cada carta informar: nome, significado simbólico e conexão com o caso do usuário.
3. Três perguntas de reflexão numeradas.
4. Duas ações práticas simples para os próximos 7 dias.
5. Encerramento curto com o lembrete: "Use isso como reflexão, não como certeza."
"""

# ============================================
# Utilidades
# ============================================

def calculate_age(raw_date: str):
    try:
        birth = datetime.strptime(raw_date, "%Y-%m-%d").date()
    except Exception:
        return None, None

    today = date.today()
    years = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
    return birth, years


def build_prompt(perfil: dict, contato: dict, dados: dict) -> str:
    nome = perfil.get("nome") or "Visitante"
    nascimento = perfil.get("data_nascimento") or "Não informado"
    idade = perfil.get("idade")
    genero = perfil.get("genero") or "Não informado"
    arquetipo = perfil.get("arquetipo") or "Não informado"
    emocao = perfil.get("emocao") or "Não informado"
    apoio = perfil.get("apoio_desejado") or "Não informado"
    foco = perfil.get("foco_pessoal") or "Não informado"

    tema = dados.get("tema") or "Tema não informado"
    desafio = dados.get("desafio") or "Desafio não informado"
    objetivo = dados.get("objetivo") or "Objetivo não informado"

    email = contato.get("email") or "Não informado"
    telefone = contato.get("telefone") or "Não informado"

    partes = [
        f"Nome preferido da pessoa: {nome}.",
        f"Idade declarada: {idade} anos." if idade is not None else "Idade não informada.",
        f"Data de nascimento: {nascimento}.",
        f"Modo de tratamento de gênero preferido: {genero}.",
        f"Arquétipo ou personalidade predominante: {arquetipo}.",
        f"Estado emocional atual: {emocao}.",
        f"Tipo de apoio esperado na leitura: {apoio}.",
        f"Foco pessoal descrito: {foco}.",
        f"Tema escolhido para a consulta: {tema}.",
        f"Dificuldade principal relatada: {desafio}.",
        f"Objetivo para os próximos dias: {objetivo}.",
        f"Contato fornecido (não mencionar na resposta): Email {email}, Telefone {telefone}.",
        "Produza a resposta seguindo estritamente o formato combinado.",
    ]

    return "\n".join(partes)


def extract_text_from_response(response) -> str:
    if getattr(response, "output_text", None):
        text = response.output_text
        if isinstance(text, list):
            return "\n".join(text).strip()
        return str(text).strip()

    collected = []
    for item in getattr(response, "output", []) or []:
        for content in getattr(item, "content", []) or []:
            text = getattr(content, "text", None)
            if text:
                value = getattr(text, "value", None) or text
                collected.append(str(value))

    return "\n".join(collected).strip()

# ============================================
# Rotas
# ============================================

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/consulta", methods=["POST"])
def consulta():
    data = request.get_json(force=True) or {}

    perfil = data.get("perfil") or {}
    contato = data.get("contato") or {}

    nome = (perfil.get("nome") or "").strip()
    genero = (perfil.get("genero") or "").strip()
    nascimento_raw = (perfil.get("data_nascimento") or "").strip()
    tema = (data.get("tema") or "").strip()
    desafio = (data.get("desafio") or "").strip()
    objetivo = (data.get("objetivo") or "").strip()
    email = (contato.get("email") or "").strip()
    telefone = (contato.get("telefone") or "").strip()

    missing = [
        field for field, value in (
            ("nome", nome),
            ("data_nascimento", nascimento_raw),
            ("genero", genero),
            ("tema", tema),
            ("desafio", desafio),
            ("email", email),
            ("telefone", telefone),
        ) if not value
    ]

    if missing:
        return jsonify({
            "erro": "Dados incompletos",
            "detalhes": f"Campos obrigatórios ausentes: {', '.join(missing)}"
        }), 400

    nascimento, idade = calculate_age(nascimento_raw)
    if not nascimento or idade is None:
        return jsonify({
            "erro": "Data de nascimento inválida",
            "detalhes": "Use o formato AAAA-MM-DD"
        }), 400

    if idade < 18:
        return jsonify({
            "erro": "Consulta não permitida",
            "detalhes": "Somente maiores de 18 anos"
        }), 400

    perfil["idade"] = idade
    perfil["data_nascimento"] = nascimento.isoformat()

    prompt = build_prompt(
        perfil,
        {"email": email, "telefone": telefone},
        {"tema": tema, "desafio": desafio, "objetivo": objetivo},
    )

    try:
        response = client.responses.create(
            model=OPENAI_MODEL,
            input=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )

        text = extract_text_from_response(response)

        if not text:
            raise Exception("Resposta vazia do modelo")

        return jsonify({"mensagem": text})

    except Exception as e:
        print("OPENAI ERROR:", e)
        return jsonify({
            "erro": "Erro ao gerar resposta",
            "detalhes": str(e)
        }), 500

# ============================================
# Inicialização (Railway)
# ============================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
