import os
from datetime import date, datetime
from flask import Flask, jsonify, render_template, request
from dotenv import load_dotenv
from openai import OpenAI

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
for candidate in ("env.local", ".env"):
    candidate_path = os.path.join(BASE_DIR, candidate)
    if os.path.exists(candidate_path):
        load_dotenv(candidate_path, override=True)
load_dotenv(override=False)

app = Flask(__name__)
client = OpenAI()

SYSTEM_PROMPT = """Você é uma terapeuta holística especializada em Tarologia simbólica. Você oferece acolhimento, metáforas e reflexões profundas, sempre deixando claro que não fornece previsões absolutas, diagnósticos nem conselhos legais. Sua linguagem é empática, humana e em português do Brasil. Incentive o autocuidado e evite gerar dependência emocional.\n\nRegras obrigatórias:\n- Conteúdo apenas para reflexão e entretenimento.\n- Não substitua terapia, medicina ou aconselhamento jurídico.\n- Utilize o tarô como metáfora simbólica e inspiradora.\n- Mantenha tom acolhedor, esperançoso e realista.\n- Nunca prometa certezas ou resultados garantidos.\n\nFormato fixo da resposta:\n1. Abertura acolhedora com 1 a 2 frases.\n2. Tiragem simbólica de 3 cartas. Para cada carta informar: nome, significado simbólico e conexão com o caso do usuário.\n3. Três perguntas de reflexão numeradas.\n4. Duas ações práticas simples para os próximos 7 dias.\n5. Encerramento curto com o lembrete: \"Use isso como reflexão, não como certeza.\"\n"""


def calculate_age(raw_date: str):
    if not raw_date:
        return None, None
    try:
        birth = datetime.strptime(raw_date, "%Y-%m-%d").date()
    except ValueError:
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
        "Contato fornecido (não mencione o email ou telefone na resposta, apenas considere que o retorno será enviado de forma privada). "
        f"Email registrado: {email}. Telefone registrado: {telefone}.",
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
            if not text:
                continue
            value = getattr(text, "value", None) or text
            if value:
                collected.append(str(value))
    return "\n".join(collected).strip()


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
        return (
            jsonify(
                {
                    "erro": "Dados incompletos.",
                    "detalhes": f"Campos obrigatórios ausentes: {', '.join(missing)}.",
                }
            ),
            400,
        )

    nascimento, idade = calculate_age(nascimento_raw)
    if not nascimento or idade is None:
        return (
            jsonify(
                {
                    "erro": "Data de nascimento inválida.",
                    "detalhes": "Use o formato AAAA-MM-DD.",
                }
            ),
            400,
        )
    if idade < 18:
        return (
            jsonify(
                {
                    "erro": "Consulta não permitida.",
                    "detalhes": "Somente maiores de 18 anos podem receber esta orientação.",
                }
            ),
            400,
        )

    perfil_atualizado = perfil.copy()
    perfil_atualizado.update(
        {
            "nome": nome,
            "genero": genero,
            "data_nascimento": nascimento.isoformat(),
            "idade": idade,
            "foco_pessoal": perfil.get("foco_pessoal") or objetivo or "Não informado",
        }
    )

    prompt = build_prompt(
        perfil_atualizado,
        {"email": email, "telefone": telefone},
        {"tema": tema, "desafio": desafio, "objetivo": objetivo},
    )

    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return (
            jsonify(
                {
                    "erro": "Não foi possível gerar a resposta.",
                    "detalhes": "OPENAI_API_KEY não configurada no ambiente.",
                }
            ),
            500,
        )

    try:
        response = client.responses.create(
            model=model,
            input=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
        text = extract_text_from_response(response)
        if not text:
            raise ValueError("Resposta vazia do modelo.")
        return jsonify({"mensagem": text})
    except Exception as exc:  # noqa: BLE001
        return (
            jsonify(
                {
                    "erro": "Não foi possível gerar a resposta.",
                    "detalhes": str(exc),
                }
            ),
            500,
        )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
