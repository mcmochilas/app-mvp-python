const stepContent = document.getElementById("stepContent");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");
const statusBadge = document.getElementById("statusBadge");
const wizardError = document.getElementById("wizardError");
const loaderOverlay = document.getElementById("loaderOverlay");
const resultModal = document.getElementById("resultModal");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");
const modalRestart = document.getElementById("modalRestart");
const modalRealConsult = document.getElementById("modalRealConsult");

const answers = {};
let currentStep = 0;
let submitButtonRef = null;
const MAX_RESPONSE_CHARS = 1800;
const REAL_CONSULT_URL = "mailto:contato@tarologa.com?subject=Consulta%20com%20tar%C3%B3loga%20real";

const truncateResponse = (text) => {
    if (!text) return "";
    return text.length > MAX_RESPONSE_CHARS ? `${text.slice(0, MAX_RESPONSE_CHARS).trim()}…` : text;
};

const getGenderTone = () => {
    const choice = (answers.genero?.value || "").toLowerCase();
    if (choice.includes("masculino")) return "masculino";
    if (choice.includes("feminino")) return "feminino";
    return "neutro";
};

const getNameTitle = () => {
    const tone = getGenderTone();
    if (tone === "masculino") return "Como você quer ser chamado?";
    if (tone === "feminino") return "Como você quer ser chamada?";
    return "Como você quer ser chamade?";
};

const steps = [
    {
        id: "genero",
        type: "options",
        title: "Como devemos tratar você?",
        helper: "Escolha o tratamento que mais respeita sua identidade ao longo da consulta.",
        statusText: "Ajustando a linguagem da consulta.",
        options: [
            { label: "Feminino (ela/dela)", value: "Tratamento feminino (ela/dela)" },
            { label: "Masculino (ele/dele)", value: "Tratamento masculino (ele/dele)" },
            { label: "Neutro (elu/delu)", value: "Tratamento neutro (elu/delu)" },
        ],
    },
    {
        id: "nome",
        type: "text",
        titleFn: getNameTitle,
        helper: "Pode ser seu nome ou apelido preferido.",
        placeholder: "Ex: Luna, Ana, João",
        statusText: "Estamos te conhecendo.",
        nextLabel: "Continuar",
    },
    {
        id: "data_nascimento",
        type: "date",
        title: "Qual é sua data de nascimento?",
        helper: "Precisamos confirmar para adaptar o tom da orientação.",
        statusText: "Confirmando sua etapa de vida.",
    },
    {
        id: "persona",
        type: "options",
        title: "Qual energia descreve melhor você hoje?",
        helper: "Escolha o arquétipo com o qual você mais se identifica neste momento.",
        statusText: "Configurando o perfil simbólico.",
        genderedKey: "persona",
    },
    {
        id: "tema",
        type: "options",
        title: "Qual tema deseja explorar?",
        helper: "Escolha a área principal da sua consulta.",
        statusText: "Selecionando o tema central.",
        options: [
            { label: "Amor e relacionamentos", value: "Amor e relacionamentos" },
            { label: "Carreira e propósito", value: "Carreira e propósito" },
            { label: "Prosperidade e recursos", value: "Prosperidade e recursos" },
            { label: "Autoconhecimento", value: "Autoconhecimento" },
            { label: "Família e laços", value: "Família e laços" },
            { label: "Espiritualidade", value: "Espiritualidade" },
        ],
    },
    {
        id: "desafio",
        type: "options",
        title: "Qual descrição combina com o desafio atual?",
        helper: "Vamos personalizar a tiragem com base nesta escolha.",
        statusText: "Entendendo a dificuldade principal.",
        options: [
            { label: "Entender sinais em um relacionamento", value: "Busca entender os sinais em um relacionamento" },
            { label: "Tomar decisões na carreira", value: "Precisa clareza para tomar decisões profissionais" },
            { label: "Reorganizar energias internas", value: "Deseja equilibrar mente, corpo e espírito" },
            { label: "Superar medos financeiros", value: "Quer superar medos financeiros e destravar prosperidade" },
            { label: "Curar vínculos familiares", value: "Procura curar vínculos e conversas em família" },
            { label: "Fortalecer a fé e intuição", value: "Busca fortalecer a fé e a intuição" },
        ],
    },
    {
        id: "emocao",
        type: "options",
        title: "Como você tem se sentido nos últimos dias?",
        helper: "Isso ajuda a IA a ajustar o tom da resposta.",
        statusText: "Registrando o clima emocional.",
        genderedKey: "emocao",
    },
    {
        id: "apoio",
        type: "options",
        title: "Que tipo de apoio você prefere receber?",
        helper: "Escolha o estilo de reflexão que mais combina com você.",
        statusText: "Ajustando o estilo da resposta.",
        options: [
            { label: "Reflexões suaves", value: "Prefere reflexões suaves e acolhedoras" },
            { label: "Passos práticos", value: "Prefere passos práticos e diretos" },
            { label: "Simbolismo profundo", value: "Prefere simbolismo profundo e meditativo" },
            { label: "Motivação inspiradora", value: "Prefere mensagens motivadoras" },
        ],
    },
    {
        id: "foco",
        type: "options",
        title: "Em que foco deseja atuar nos próximos 7 dias?",
        helper: "Defina o direcionamento da orientação.",
        statusText: "Definindo o foco futuro.",
        options: [
            { label: "Cuidar de mim com carinho", value: "Quer focar em autocuidado e limites saudáveis" },
            { label: "Avançar com coragem", value: "Quer avançar com coragem em decisões importantes" },
            { label: "Ouvir minha intuição", value: "Quer ouvir melhor a intuição" },
            { label: "Construir diálogos honestos", value: "Quer construir diálogos honestos" },
            { label: "Atrair prosperidade consciente", value: "Quer atrair prosperidade consciente" },
        ],
    },
    {
        id: "contato",
        type: "contact",
        title: "Onde devemos enviar a resposta?",
        helper: "Informe email e telefone. Mostraremos a reflexão aqui e você poderá encaminhar como preferir.",
        statusText: "Preparando o envio seguro.",
    },
];

const genderedOptionsMap = {
    persona: [
        {
            feminino: { label: "Sonhadora sensível", value: "Sonhadora sensível que segue a intuição" },
            masculino: { label: "Sonhador sensível", value: "Sonhador sensível que segue a intuição" },
            neutro: { label: "Sonhador(e) sensível", value: "Sonhador(e) sensível que segue a intuição" },
        },
        {
            feminino: { label: "Estrategista prática", value: "Estrategista prática que prefere passos claros" },
            masculino: { label: "Estrategista prático", value: "Estrategista prático que prefere passos claros" },
            neutro: { label: "Estrategista práticx", value: "Estrategista práticx que prefere passos claros" },
        },
        {
            feminino: { label: "Curadora cuidadosa", value: "Curadora cuidadosa que acolhe e protege" },
            masculino: { label: "Curador cuidadoso", value: "Curador cuidadoso que acolhe e protege" },
            neutro: { label: "Curador(e) cuidadose", value: "Curador(e) cuidadose que acolhe e protege" },
        },
        {
            feminino: { label: "Exploradora ousada", value: "Exploradora ousada que busca novas experiências" },
            masculino: { label: "Explorador ousado", value: "Explorador ousado que busca novas experiências" },
            neutro: { label: "Explorador(e) ousade", value: "Explorador(e) ousade que busca novas experiências" },
        },
    ],
    emocao: [
        {
            feminino: { label: "Esperançosa", value: "Se sente esperançosa" },
            masculino: { label: "Esperançoso", value: "Se sente esperançoso" },
            neutro: { label: "Esperançose", value: "Se sente esperançose" },
        },
        {
            feminino: { label: "Apreensiva", value: "Se sente apreensiva" },
            masculino: { label: "Apreensivo", value: "Se sente apreensivo" },
            neutro: { label: "Apreensive", value: "Se sente apreensive" },
        },
        {
            feminino: { label: "Cansada", value: "Se sente cansada e sem energia" },
            masculino: { label: "Cansado", value: "Se sente cansado e sem energia" },
            neutro: { label: "Cansade", value: "Se sente cansade e sem energia" },
        },
        {
            feminino: { label: "Motivada", value: "Se sente motivada para agir" },
            masculino: { label: "Motivado", value: "Se sente motivado para agir" },
            neutro: { label: "Motivade", value: "Se sente motivade para agir" },
        },
        {
            feminino: { label: "Confusa", value: "Se sente confusa e indecisa" },
            masculino: { label: "Confuso", value: "Se sente confuso e indeciso" },
            neutro: { label: "Confuse", value: "Se sente confuse e indecise" },
        },
    ],
};

const setStatus = (text) => {
    if (statusBadge) {
        statusBadge.textContent = text;
    }
};

const clearError = () => {
    wizardError.textContent = "";
    wizardError.classList.add("hidden");
};

const showError = (message) => {
    wizardError.textContent = message;
    wizardError.classList.remove("hidden");
};

const createBackButton = () => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghost-button";
    button.textContent = "Voltar";
    button.addEventListener("click", () => {
        if (currentStep > 0) {
            currentStep -= 1;
            renderStep();
        }
    });
    return button;
};

const resolveGenderedOptions = (key) => {
    const tone = getGenderTone();
    const config = genderedOptionsMap[key];
    if (!config) {
        return [];
    }
    return config.map((variant) => {
        if (tone === "masculino") return variant.masculino;
        if (tone === "feminino") return variant.feminino;
        return variant.neutro;
    });
};

const evaluateAge = (value) => {
    if (!value) {
        return { valid: false, message: "Informe sua data de nascimento." };
    }
    const birthDate = new Date(value);
    if (Number.isNaN(birthDate.getTime())) {
        return { valid: false, message: "Data inválida." };
    }
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age -= 1;
    }
    if (age < 18) {
        return { valid: false, message: "Consulta destinada apenas a maiores de 18 anos." };
    }
    return { valid: true, age };
};

const goToNextStep = () => {
    if (currentStep < steps.length - 1) {
        currentStep += 1;
        renderStep();
    }
};

const handleOptionSelection = (step, option) => {
    clearError();
    answers[step.id] = { value: option.value };
    goToNextStep();
};

const renderTextStep = (step) => {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "text-input";
    input.placeholder = step.placeholder || "";
    input.value = answers[step.id]?.value || "";
    stepContent.appendChild(input);

    const actions = document.createElement("div");
    actions.className = "actions";
    if (currentStep > 0) {
        actions.appendChild(createBackButton());
    }

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "primary-button";
    nextButton.textContent = step.nextLabel || "Avançar";
    nextButton.addEventListener("click", () => {
        clearError();
        const value = input.value.trim();
        if (value.length < 2) {
            showError("Informe ao menos duas letras.");
            return;
        }
        answers[step.id] = { value };
        goToNextStep();
    });
    actions.appendChild(nextButton);
    stepContent.appendChild(actions);
};

const renderDateStep = () => {
    const input = document.createElement("input");
    input.type = "date";
    input.className = "text-input";
    input.max = new Date().toISOString().split("T")[0];
    input.value = answers.data_nascimento?.value || "";

    const ageInfo = document.createElement("p");
    ageInfo.className = "helper";
    if (answers.data_nascimento?.value && answers.data_nascimento?.age) {
        ageInfo.textContent = `Idade calculada: ${answers.data_nascimento.age} anos.`;
    }

    input.addEventListener("input", () => {
        clearError();
        const { valid, age, message } = evaluateAge(input.value);
        if (!valid) {
            ageInfo.textContent = message;
            ageInfo.classList.add("error");
        } else {
            ageInfo.textContent = `Idade calculada: ${age} anos.`;
            ageInfo.classList.remove("error");
        }
    });

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.appendChild(createBackButton());

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "primary-button";
    nextButton.textContent = "Continuar";
    nextButton.addEventListener("click", () => {
        clearError();
        const { valid, age, message } = evaluateAge(input.value);
        if (!valid) {
            showError(message);
            return;
        }
        answers.data_nascimento = { value: input.value, age };
        goToNextStep();
    });

    actions.appendChild(nextButton);
    stepContent.appendChild(input);
    stepContent.appendChild(ageInfo);
    stepContent.appendChild(actions);
};

const renderOptionsStep = (step) => {
    const grid = document.createElement("div");
    grid.className = "options-grid";
    const options = step.genderedKey ? resolveGenderedOptions(step.genderedKey) : step.options;

    options.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "option-button";
        button.textContent = option.label;
        if (answers[step.id]?.value === option.value) {
            button.classList.add("active");
        }
        button.addEventListener("click", () => handleOptionSelection(step, option));
        grid.appendChild(button);
    });

    stepContent.appendChild(grid);

    if (currentStep > 0) {
        const actions = document.createElement("div");
        actions.className = "actions single";
        actions.appendChild(createBackButton());
        stepContent.appendChild(actions);
    }
};

const renderContactStep = () => {
    const contactGrid = document.createElement("div");
    contactGrid.className = "contact-grid";

    const emailField = document.createElement("input");
    emailField.type = "email";
    emailField.className = "text-input";
    emailField.placeholder = "Email";
    emailField.value = answers.contato_email?.value || "";

    const phoneField = document.createElement("input");
    phoneField.type = "tel";
    phoneField.className = "text-input";
    phoneField.placeholder = "Telefone com DDD";
    phoneField.value = answers.contato_telefone?.value || "";

    contactGrid.appendChild(emailField);
    contactGrid.appendChild(phoneField);
    stepContent.appendChild(contactGrid);

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.appendChild(createBackButton());

    const submitButton = document.createElement("button");
    submitButton.type = "button";
    submitButton.className = "primary-button";
    submitButton.textContent = "Consultar Taróloga IA";
    submitButton.addEventListener("click", () => {
        submitConsultation(emailField.value, phoneField.value);
    });
    actions.appendChild(submitButton);
    submitButtonRef = submitButton;

    stepContent.appendChild(actions);
};

const renderStep = () => {
    clearError();
    submitButtonRef = null;
    const step = steps[currentStep];
    const percent = (currentStep / (steps.length - 1)) * 100;
    progressFill.style.width = `${percent}%`;
    progressLabel.textContent = `Passo ${currentStep + 1} de ${steps.length}`;
    setStatus(step.statusText || "Respondendo ao questionário.");

    stepContent.innerHTML = "";
    const title = document.createElement("h2");
    title.className = "step-title";
    title.textContent = typeof step.titleFn === "function" ? step.titleFn() : step.title;
    stepContent.appendChild(title);

    const helperText = typeof step.helperFn === "function" ? step.helperFn() : step.helper;
    if (helperText) {
        const helper = document.createElement("p");
        helper.className = "helper";
        helper.textContent = helperText;
        stepContent.appendChild(helper);
    }

    if (step.type === "text") {
        renderTextStep(step);
    } else if (step.type === "date") {
        renderDateStep(step);
    } else if (step.type === "options") {
        renderOptionsStep(step);
    } else if (step.type === "contact") {
        renderContactStep(step);
    }
};

const validateEmail = (value) => {
    const regex = /^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/;
    return regex.test(value);
};

const sanitizePhone = (value) => value.replace(/[^0-9+]/g, "");

const buildPayload = (email, phone) => ({
    tema: answers.tema?.value || "",
    desafio: answers.desafio?.value || "",
    objetivo: answers.foco?.value || "",
    perfil: {
        nome: answers.nome?.value || "",
        data_nascimento: answers.data_nascimento?.value || "",
        genero: answers.genero?.value || "",
        arquetipo: answers.persona?.value || "",
        emocao: answers.emocao?.value || "",
        apoio_desejado: answers.apoio?.value || "",
        foco_pessoal: answers.foco?.value || "",
    },
    contato: {
        email,
        telefone: phone,
    },
});

const toggleOverlay = (show) => {
    if (!loaderOverlay) return;
    loaderOverlay.classList.toggle("hidden", !show);
};

const setSubmitting = (isLoading) => {
    if (submitButtonRef) {
        submitButtonRef.disabled = isLoading;
        submitButtonRef.textContent = isLoading
            ? "Criando reflexão..."
            : "Gerar reflexão personalizada";
    }
    toggleOverlay(isLoading);
    if (isLoading) {
        setStatus("Consultando a terapeuta holística...");
    }
};

const submitConsultation = async (rawEmail, rawPhone) => {
    clearError();
    const email = rawEmail.trim().toLowerCase();
    const phone = sanitizePhone(rawPhone.trim());

    if (!validateEmail(email)) {
        showError("Informe um email válido.");
        return;
    }
    if (phone.length < 8) {
        showError("Informe um telefone válido com DDD.");
        return;
    }

    answers.contato_email = { value: email };
    answers.contato_telefone = { value: phone };

    setSubmitting(true);
    try {
        const response = await fetch("/api/consulta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildPayload(email, phone)),
        });
        const payload = await response.json();
        if (!response.ok) {
            const message = payload?.erro || "Não foi possível gerar a resposta.";
            throw new Error(message);
        }
        showModal(payload.mensagem);
        setStatus("Reflexão pronta para ser lida.");
    } catch (error) {
        showError(error.message);
        setStatus("Revise os dados e tente novamente.");
    } finally {
        setSubmitting(false);
    }
};

const showModal = (message) => {
    if (!resultModal) return;
    modalBody.textContent = truncateResponse(message);
    resultModal.classList.remove("hidden");
};

const closeModal = () => {
    resultModal.classList.add("hidden");
};

modalClose?.addEventListener("click", closeModal);
modalRestart?.addEventListener("click", () => {
    window.location.reload();
});
modalRealConsult?.addEventListener("click", () => {
    window.open(REAL_CONSULT_URL, "_blank", "noopener");
});

renderStep();
