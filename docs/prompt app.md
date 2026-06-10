## ANTES DE COMEÇAR: CONTEXTO DO PROJETO

[PREENCHA ANTES DE ENVIAR O PROMPT]

	•	Nome do projeto: [NOME_DO_PROJETO]
	•	O que faz: [DESCRIÇÃO_CURTA_DO_APP / FUNÇÃO PRINCIPAL]
	•	Para quem: [PÚBLICO-ALVO IDEAL — ex: perfil, idade, estilo de vida, profissão, nível de renda]
	•	Sensação desejada: [COMO O USUÁRIO DEVE SE SENTIR AO USAR — ex: premium, hacker, acolhedor, técnico, criativo]
	•	O que NÃO quer parecer: [REFERÊNCIAS NEGATIVAS — ex: app genérico, banco tradicional, dashboard corporativo, template comum]
	•	Light mode, dark mode ou ambos: [LIGHT / DARK / AMBOS]
	•	Referência de energia (opcional): [REFERÊNCIAS DE ESTILO VISUAL, MARCAS OU PRODUTOS — ex: “a precisão do Linear + a energia tech do Supabase”]


# CRIAÇÃO DE IDENTIDADE VISUAL A PARTIR DE REFERÊNCIAS

## O QUE ESTE PROMPT FAZ
Você vai criar uma identidade visual ORIGINAL para um app. Não é trocar cores de um template. É criar uma experiência visual que tenha ALMA — onde cada tela conta uma história e cada componente tem personalidade.

O resultado é um documento .md que funciona como "DNA visual" do projeto — qualquer IA que ler esse documento vai gerar interfaces com personalidade própria, não templates recoloridos.

---

## O PROBLEMA QUE ESTE PROMPT RESOLVE

Quando você pede pra uma IA criar uma interface, ela entrega o DEFAULT:
Sidebar lateral + cards brancos vazios + tabela com headers + ícones Lucide soltos + Inter/Geist + shadow-md + rounded-lg + cores do Tailwind. Tudo flat, limpo, vazio.

Se você pede "com identidade visual", ela troca as cores. Talvez mude a fonte. Talvez tire a sidebar. Mas os cards continuam sendo caixas vazias com texto. A tela continua sendo um grid de retângulos. Não tem VIDA.

E se você dá uma "biblioteca de decorações genéricas" (blobs, dot grids, partículas), ela espalha esses elementos em tudo. O resultado: cards que antes eram vazios agora têm barulho visual genérico. Um blob atrás de um número não é identidade — é ruído. Um dot grid no canto não é personalidade — é enfeite.

E se você pede "identidade com cores", ela cria 5 cores para categorias, gradientes em todos os fundos, glow borders em todo hover, sombras coloridas em todo card. O resultado: arco-íris visual que parece psicodélico, não profissional. Supabase não usa 5 cores. Usa UMA (verde) + neutros. CoffeeStack não usa gradientes em tudo. Usa UMA (laranja) + branco/cinza.

**O que falta não é decoração. É CONCEITO VISUAL.**

Compare mentalmente:
- Um card de "Storage" com um dot grid no canto → DECORADO, MAS SEM CONCEITO
- Um card de "Storage" com uma grade de thumbnails de arquivo que se organizam → SUPABASE (conceito: "seus arquivos organizados")

- Um card de "Progresso" com um blob gradiente atrás do número → DECORADO, MAS SEM CONCEITO
- Um card de "Progresso" com uma rota de avião tracejada indo de um ponto a outro, onde o avião está em 25% do caminho → CONCEITO (conta a história: "sua viagem está aqui")

- Um card de "Realtime" com partículas flutuantes → DECORADO, MAS SEM CONCEITO
- Um card de "Realtime" com cursores de diferentes usuários e balões de chat se movendo → SUPABASE (conceito: "pessoas colaborando ao vivo")

A diferença: **decoração genérica** é visual que poderia estar em qualquer card de qualquer app. **Conceito visual** é uma ilustração/cena que SÓ faz sentido naquele card daquele app porque conta uma história sobre o que o card REPRESENTA.

---

## A DIFERENÇA ENTRE DECORAÇÃO E CONCEITO

### DECORAÇÃO GENÉRICA (evitar como padrão único):
- Gradient blobs atrás de números
- Dot grids no canto dos cards  
- Partículas flutuantes aleatórias
- Noise textures
- Glow borders no hover
- Gradientes em todo lugar (fundos, cards, botões, ícones)
- Múltiplas cores de "categorias" (praia=azul, cidade=amarelo, etc.)
- Glassmorphism em todos os elementos
- Sombras coloridas/glow em tudo

Esses elementos têm seu lugar — como **textura de fundo**, como **camada ambiente**, como **complemento**. Mas eles NUNCA devem ser a principal estratégia de riqueza visual. Se todo card do app tem blob + dot grid + partículas, não é identidade — é um template de decoração genérica.

### CONCEITO VISUAL (o objetivo):
Cada componente importante tem uma **ilustração/cena conceitual** que conta uma história visual sobre o que aquele componente REPRESENTA. A IA que implementa cria essa ilustração usando SVG inline, CSS, ou composição de formas — sem precisar de assets externos.

**Como funciona na prática:**

O card de "Vector" do Supabase não tem um blob. Tem um **cubo wireframe isométrico** com pontos de dados flutuando ao redor. É um conceito: "espaço vetorial multidimensional". Isso é implementável em SVG puro — são linhas, cubos e círculos posicionados.

O card de "Realtime" do Supabase não tem um dot grid. Tem **cursores de mouse** com **balões de chat** — um cinza, um verde. É um conceito: "duas pessoas interagindo em tempo real". Implementável em SVG: formas de cursor + pills com dots.

O card de "Storage" do Supabase não tem partículas. Tem uma **grade de thumbnails** representando tipos de arquivo (imagem, vídeo, documento). É um conceito: "todos os seus arquivos organizados". Implementável em SVG: grid de retângulos com ícones simplificados dentro.

O CoffeeStack não tem um gradient blob atrás do mascote. Tem um **copo de café 3D** conectado a **nós de rede** com linhas — como se o café fosse o centro de uma constelação de dados. É um conceito: "café como hub de informações". O copo é um asset externo, mas os nós e linhas são SVG puro.

**PRINCÍPIO FUNDAMENTAL: Cada card importante merece um CONCEITO, não uma DECORAÇÃO.**

---

## A REGRA DA COR ÚNICA

Olhe para qualquer app com identidade forte:

- **Supabase:** fundo dark + **verde**. Só verde. Todo o resto é cinza, branco, preto. O verde aparece no logo, nos botões, nos acentos de código, nos ícones ativos. É a ÚNICA cor vibrante.
- **CoffeeStack:** fundo light + **laranja**. Só laranja. Todo o resto é branco, cinza claro, preto. O laranja aparece no logo do copo, nos badges de venda, nos botões, nos gráficos.
- **Firecrawl:** fundo light + **laranja**. Só laranja. Todo o resto é branco, cinza. O laranja aparece no logo de fogo, nos ícones de ação, nos snippets de código, nos cruzes decorativos.
- **Linear:** fundo dark + **violeta/azul**. Todo o resto é cinza e branco. Uma cor só.
- **Vercel:** fundo dark + **branco**. Sem cor accent sequer. Preto e branco puro. A identidade vive na estrutura e tipografia.

**O padrão é claro:** identidade visual forte = base limpa (light OU dark) + UMA cor primária forte + elementos visuais de UI que reforçam a marca.

### O que NÃO é identidade:
- Gradientes em tudo (gradiente no fundo, nos cards, nos botões, nos ícones) → é barulho, não marca
- 5 cores de "categorias" (praia = azul, cidade = amarelo, natureza = verde, cultura = roxo) → é arco-íris, não identidade. O Supabase não usa cores diferentes pra cada feature — tudo é verde
- Glassmorphism em todos os elementos → é efeito, não marca
- Sombras coloridas / glow em tudo → é noise

### A regra:
1. **Escolha UMA base:** light (branco/cinza claro) ou dark (preto/cinza escuro/navy)
2. **Escolha UMA cor primária forte:** a cor da marca. Vai aparecer no logo, botões, links, ícones ativos, badges, acentos de gráficos. É a ÚNICA cor vibrante da interface
3. **Todo o resto é neutro:** cinzas, brancos, pretos. Texto usa escala de neutros. Cards usam neutros. Bordas usam neutros
4. **Cores de status são funcionais, não decorativas:** success/error/warning aparecem APENAS quando necessário (confirmação, erro, alerta), não como sistema de categorias visuais
5. **A cor primária deve ser FORTE e RECONHECÍVEL:** se alguém vê a cor isolada, pensa no app. Verde = Supabase. Laranja = CoffeeStack/Firecrawl. Roxo = Figma.

### Como isso muda o documento de identidade:
Na seção de Tokens de Design, a paleta de cores deve ser ENXUTA:
- 3-4 tons de fundo (page, card, elevated, hover)
- 3 tons de texto (primary, secondary, muted)
- 1 cor accent com 2-3 variações (primary, hover, sutil/translúcida)
- Cores de status (success, error, warning) — usadas APENAS para feedback funcional

NÃO crie tokens para "accent-beach", "accent-city", "accent-nature", "accent-culture". Isso fragmenta a identidade. Um app com identidade usa UMA cor accent para TUDO que precisa de destaque.

---

## AS TRÊS CAMADAS DA IDENTIDADE

A identidade visual de um app vive em três camadas. A maioria dos prompts só trata da primeira. Este prompt trata das três.

### Camada 1: ESTRUTURA
Como a interface se organiza.
↳ Navegação (sidebar? dock? tabs? bottom bar?)
↳ Layout (grid simétrico? assimétrico? hero dominante?)
↳ Hierarquia (o que chama atenção primeiro?)
↳ Apresentação de dados (tabela? feed? cards? timeline?)
↳ Densidade (compacto? espaçoso? misto?)

### Camada 2: LINGUAGEM
Como os elementos se expressam.
↳ Tipografia (uma fonte? mistura? manuscrita? serifada? monospace?)
↳ Cores como sistema (UMA cor accent forte + neutros. Ver "A REGRA DA COR ÚNICA" acima)
↳ Geometria (cantos extremos? pill? retos? mistura intencional?)
↳ Profundidade (sombras etéreas? flat? glassmorphism? sem sombra?)
↳ Iconografia (line? filled? duotone? emojis 3D? com background?)

### Camada 3: RIQUEZA VISUAL ← A CAMADA QUE FAZ A DIFERENÇA
O que vive DENTRO dos componentes além de texto e ícones.

Essa é a camada que separa um app com identidade de um template bonito.

**Riqueza visual tem dois níveis:**

#### Nível A: TEXTURA AMBIENTE (fundo, atmosfera)
São elementos sutis que criam atmosfera geral. Vivem no FUNDO, nunca são protagonistas. Exemplos:
- Pattern geométrico sutil no background (topográfico, grid, ondas, wireframes) — opacity 3-5%
- Noise/grain como textura de papel
- Elementos wireframe decorativos nas bordas (como Firecrawl usa: snippets de JSON, wireframes de página)

Esses elementos são simples, monocromáticos, e reutilizáveis — podem aparecer em todas as telas. São a "base" sobre a qual o restante é construído. Usam APENAS tons neutros ou a cor accent em opacidade muito baixa. NUNCA gradientes coloridos como textura — isso vira barulho.

#### Nível B: CONCEITO VISUAL (dentro dos componentes) ← O QUE REALMENTE IMPORTA
São ilustrações/cenas conceituais ÚNICAS para cada componente importante. Cada uma conta uma história visual sobre o que aquele componente REPRESENTA. Exemplos:

- Card "Storage" → grade de thumbnails de arquivo se organizando (conceito: seus arquivos)
- Card "Realtime" → cursores + balões de chat (conceito: colaboração ao vivo)  
- Card "Progresso de Viagem" → rota de avião tracejada com marcador de posição (conceito: onde você está na jornada)
- Card "Checklist" → items conectados por uma linha vertical com nós, como um timeline (conceito: etapas de preparação)
- Card "Clima" → ondas SVG + ícone de sol com raios animados (conceito: o clima te espera)

**A IA que implementa deve CRIAR essas ilustrações conceituais usando SVG inline, CSS, e composição de formas.** Não são assets externos. São composições originais de formas geométricas básicas (linhas, círculos, retângulos, paths, arcos) que juntas formam uma cena com significado.

**O que a IA consegue criar em SVG/CSS puro:**
↳ Objetos wireframe (cubos isométricos, prédios simplificados, montanhas, ondas)
↳ Cenas com linhas e nós (rotas, constelações, grafos, timelines)
↳ Composições de formas (grids de thumbnails, stacks de cards, layers sobrepostas)
↳ Elementos temáticos geométricos (bússola, mapa simplificado, avião/barco como path)
↳ Ícones grandes decorativos (versão expandida e detalhada do ícone temático do card)
↳ Padrões conceituais (pegadas, rotas, ondas sonoras, batimentos, circuitos)
↳ Cenários mínimos (horizonte de cidade, linha do mar, silhueta de montanha)

**O que funciona COM AJUDA (humano gera o asset, IA integra):**
↳ Ícones/mascotes figurativos complexos (copo de café 3D, animal detalhado) — humano gera via SVGMaker.io, Figma, ou IA de imagem + SVGR
↳ Animações complexas de SVG (path morphing, montagem de logo) — humano cria no LottieFiles ou After Effects
↳ Ilustrações com sombras/gradientes complexos — humano exporta de Figma/Illustrator

**O que NÃO funciona (IA gera mal, evite):**
↳ Pessoas, rostos, mãos, animais detalhados via código
↳ Fotos reais — precisa de URL ou arquivo
↳ Objetos 3D com sombreamento realista

**Regra de escalabilidade:** Se o conceito ideal é complexo demais para SVG puro, SIMPLIFIQUE o conceito mantendo a história. Exemplo: se o ideal seria uma ilustração detalhada de uma mala de viagem → alternativa: silhueta geométrica de mala feita com retângulos arredondados + linhas. A história ("sua bagagem") se mantém, a complexidade cai.

---

## COMO PENSAR CONCEITOS VISUAIS (PROCESSO OBRIGATÓRIO)

Para cada componente importante do app, a IA que gera o documento de identidade deve seguir este processo:

### Passo 1: O que este componente REPRESENTA?
Não "o que ele exibe" — o que ele SIGNIFICA para o usuário.
- "Checklist de viagem" → preparação, etapas, caminho até estar pronto
- "Progresso" → jornada, distância percorrida, posição no caminho
- "Viagens recentes" → memórias, lugares visitados, mapa de experiências
- "Clima" → o que te espera, a atmosfera do destino

### Passo 2: Qual METÁFORA VISUAL traduz esse significado?
- Preparação → timeline vertical com nós / trilha com checkpoints
- Jornada → rota tracejada de A a B / arco de avião no céu
- Memórias → polaroids empilhadas / pins em um mapa
- Atmosfera → ondas/nuvens/raios de sol compostos de formas geométricas

### Passo 3: Essa metáfora é implementável em SVG/CSS puro?
- Se SIM → descreva com detalhe suficiente para a IA implementar
- Se NÃO → simplifique: use versão wireframe/geométrica da mesma metáfora
- Se AINDA NÃO → marque como [ASSET EXTERNO] e explique como gerar

### Passo 4: Descreva a cena visual
Não diga "adicione um SVG decorativo". Descreva a CENA:
- "Uma rota tracejada em arco, saindo de um círculo (origem) até outro círculo (destino). Na rota, um pequeno triângulo representando um avião, posicionado em 25% do caminho. A rota tem opacidade baixa (8-10%). O avião tem a cor accent. Os círculos de origem e destino têm tamanhos diferentes (o destino é maior, chamando mais atenção)."

Esse nível de detalhe é o que permite a IA implementar algo com CONCEITO, não apenas decoração.

---

## REGRAS TÉCNICAS (OBRIGATÓRIAS)

### Stack
- **Tailwind CSS** para toda estilização (NUNCA criar arquivos .css separados)
- **shadcn/ui** como base de componentes, customizados via className
- **Tokens semânticos** para TODOS os valores visuais (cores, radius, sombras)

### Tokens Semânticos
Todos os valores visuais devem ser definidos como tokens com nomes que carregam INTENÇÃO.

**Errado:** `bg-[#E87B5F]`, `rounded-[24px]`, `shadow-[0_8px_30px_rgba(0,0,0,0.03)]`
**Certo:** `bg-accent-primary`, `rounded-card`, `shadow-card`

No documento, cada token é definido com: nome semântico + valor real + onde usar.
Na implementação, os tokens são registrados no tailwind.config e usados pelo nome.

### Proibições
- NUNCA usar cores padrão do Tailwind (gray-100, blue-500) — apenas tokens do documento
- NUNCA usar border-radius padrão (rounded-md, rounded-lg) — apenas tokens do documento
- NUNCA usar sombras padrão (shadow-sm, shadow-md) — apenas tokens do documento
- NUNCA entregar cards que sejam apenas "caixa com texto e ícone" — todo card importante precisa de conceito visual
- NUNCA usar decoração genérica (blob + dots + partículas) como substituto de conceito visual
- NUNCA criar múltiplas cores accent — identidade é UMA cor primária forte + neutros
- NUNCA usar gradientes como "identidade" — gradientes são tempero pontual, não substituto de cor sólida forte
- NUNCA colorir categorias com cores diferentes (praia=azul, cidade=amarelo) — use a cor accent única para tudo

---

## ETAPA 1: ANÁLISE DAS REFERÊNCIAS

Analise os screenshots anexados. Para cada um:

**1. Sensação geral**
Que ambiente esse app evoca? O que faz querer explorar a interface?

**2. Decisões de ESTRUTURA (Camada 1)**
Como se organiza? Navegação, layout, hierarquia, apresentação de dados.

**3. Decisões de LINGUAGEM (Camada 2)**
Como se expressa? Tipografia, cores, geometria, profundidade, ícones.

**4. Decisões de RIQUEZA VISUAL (Camada 3) ← FOCO PRINCIPAL**
Separe em dois níveis:
- **Textura ambiente:** O que vive no fundo? Patterns, gradientes, texturas?
- **Conceitos visuais:** O que vive DENTRO de cada card? Qual é a CENA/ILUSTRAÇÃO conceitual? O que ela REPRESENTA? Como ela conta a história do que o card faz?

Procure especificamente: que metáfora visual o card usa? O que a ilustração "diz" sobre a funcionalidade? Como as formas se conectam ao significado?

**5. Qual princípio extrair de cada decisão?**
Não "copiar o cubo do Supabase". Sim: "Cada card importante tem uma ilustração conceitual em wireframe que traduz visualmente o que a funcionalidade FAZ — não é decoração, é narrativa visual."

---

## ETAPA 2: CRIAÇÃO DA IDENTIDADE

Use os princípios extraídos + contexto do projeto.

### O teste central:
**"Tirando as cores, o que muda em relação a um template shadcn padrão?"**

A resposta deve incluir mudanças nas TRÊS camadas:
- Estrutura: algo no layout/navegação/hierarquia é diferente
- Linguagem: tipografia/geometria/ícones têm personalidade
- Riqueza visual: os componentes têm CONCEITOS VISUAIS — não são caixas vazias, e não são caixas com decoração genérica

Se a resposta for "só mudaram as cores", está errado.
Se a resposta for "mudou layout e cores, mas os cards são caixas vazias com texto", está errado.
Se a resposta for "mudou layout e cores, e os cards têm blobs e dot grids", TAMBÉM está errado — isso é decoração genérica, não conceito.
Se a resposta for "mudou tudo e usa 5 cores diferentes por categoria", está errado — identidade é UMA cor forte, não arco-íris.

### O processo para riqueza visual:

**Para cada componente importante do app, siga o processo de 4 passos:**

1. **O que este componente REPRESENTA?** (significado, não dados)
2. **Qual METÁFORA VISUAL traduz isso?** (cena, não decoração)
3. **É implementável em SVG/CSS puro?** (viabilidade)
4. **Descreva a CENA com detalhe** (pra IA implementar, não interpretar)

**Escolha os 4-6 componentes mais importantes** do app e crie conceitos visuais para cada um. O resto pode ser clean — o contraste entre componentes com conceito e componentes limpos É a identidade.

### Regra de textura ambiente:
ALÉM dos conceitos visuais por componente, defina UMA textura ambiente para o app inteiro — um pattern ou gradiente sutil que vive no fundo e cria atmosfera. Essa textura deve ser temática (topográfica pra viagem, circuito pra tech, ondas pra música) e com opacidade muito baixa (3-5%).

---

## FORMATO DE SAÍDA

Entregue um documento .md. O documento deve ser descritivo o suficiente para a IA que IMPLEMENTA criar visuais ÚNICOS — sem código pronto, mas com descrições visuais tão detalhadas que não deixam espaço para interpretação genérica.

**REGRA CRÍTICA: O documento NÃO deve conter blocos de código prontos para copiar.** Se você der código, a IA que implementa vai copiar ao invés de criar. O objetivo é dar DIREÇÃO CRIATIVA com DETALHE SUFICIENTE para a IA criar algo original. Descreva as cenas visuais com palavras — a IA que implementa traduz em código.

```md
# IDENTIDADE VISUAL — [Nome do Projeto]

## Stack Técnica
- Tailwind CSS para toda estilização (NUNCA criar arquivos .css separados)
- shadcn/ui como base de componentes, customizados via className
- Todos os valores visuais definidos como TOKENS SEMÂNTICOS no tailwind.config
- NUNCA usar valores hardcoded no código — sempre tokens semânticos
- NUNCA usar cores/radius/sombras padrão do Tailwind — apenas tokens deste documento
- A IA que implementa é RESPONSÁVEL por criar SVGs originais e composições visuais únicas baseadas nas descrições abaixo — NÃO use decoração genérica (blobs, dot grids, partículas) como substituto
- A paleta usa UMA cor accent forte + neutros. NÃO crie arco-íris de categorias. A identidade é uma cor só.

## Setup Necessário (instalar antes de buildar)

### Libs adicionais
[Liste APENAS se algum momento de riqueza visual exigir.]
| Lib | Pra quê | Instalação |
|---|---|---|
| `framer-motion` | Animações de entrada e micro-interações | `npm i framer-motion` |

### Assets externos
[Liste APENAS se necessário. Inclua instruções práticas.]
| Asset | Pra quê | Como gerar |
|---|---|---|
| [ex: Fotos de destinos] | [Hero cards] | [Unsplash.com → busque por cidade → /public/images] |

---

## A Alma do App
[2-3 frases que capturam a PERSONALIDADE. Específico e com atitude.]

---

## Referências e Princípios
[Para cada app analisado:]
- **[Nome]:** [O que se destaca nas 3 camadas] → Princípio: [princípio] → Aplicação: [como transformou]

---

## Decisões de Identidade

### ESTRUTURA
[Organize por dimensão relevante]

#### [Dimensão — ex: Navegação]
**O que:** [A decisão]
**Por que:** [Por que cria identidade]
**Como:** [Implementação com tokens semânticos]
**Nunca:** [O que evitar]

### LINGUAGEM
[Organize por dimensão relevante]

#### [Dimensão — ex: Tipografia]
**O que:** [A decisão]
**Por que:** [...]
**Como:** [...]
**Nunca:** [...]

### RIQUEZA VISUAL ← OBRIGATÓRIO

#### Textura Ambiente
**O que:** [A textura/pattern que vive no fundo de toda a interface]
**Temática:** [Por que essa textura se conecta ao tema do app]
**Tratamento:** [Opacity, posição, se é fixa ou se move. DEVE ser monocromática — neutros ou accent em opacity 3-5%. NUNCA gradientes coloridos]

#### Conceitos Visuais por Componente

[Para CADA componente importante (4-6 componentes), descreva o conceito visual seguindo os 4 passos:]

##### [Nome do componente — ex: Card de Progresso da Viagem]
**Representa:** [O que este componente SIGNIFICA para o usuário — não o que exibe]
**Metáfora visual:** [Qual cena/ilustração traduz esse significado]
**Cena detalhada:** [Descrição visual DETALHADA da composição. Formas, posições, proporções, opacidades, relações entre elementos. Detalhe SUFICIENTE para a IA criar algo específico, não genérico. Pense como um storyboard.]
**Viabilidade:** [CÓDIGO PURO / ASSET EXTERNO]
**Se asset externo:** [Tipo + como gerar rapidamente]
**Alternativa simplificada:** [Se o conceito for complexo demais, versão wireframe/geométrica]

##### [Nome do componente — ex: Card de Checklist]
[...]

##### [Nome do componente — ex: Hero do Destino]
[...]

##### [Nome do componente — ex: Card de Viagens Recentes]
[...]

##### [Nome do componente — ex: Card de Clima]
[...]

##### [Nome do componente — ex: Empty State]
[...]

---

## Tokens de Design

### Cores — Fundos
| Token | Valor | Uso |
|---|---|---|
| `surface-page` | [hex] | Fundo principal |
| `surface-card` | [hex] | Cards |
| `surface-elevated` | [hex] | Elementos elevados |

### Cores — Texto
| Token | Valor | Uso |
|---|---|---|
| `text-primary` | [hex] | Títulos |
| `text-secondary` | [hex] | Apoio |
| `text-muted` | [hex] | Hints |

### Cores — Accent (UMA COR APENAS)
| Token | Valor | Uso |
|---|---|---|
| `accent-primary` | [hex] | A COR da marca — botões, links, ícones ativos, badges, acentos |
| `accent-hover` | [hex] | Hover state do accent |
| `accent-subtle` | [hex com opacity] | Fundos translúcidos do accent (ex: badge backgrounds, hover tints) |

[NUNCA criar múltiplas cores accent por "categoria" — fragmenta a identidade. UMA cor para tudo.]

### Cores — Status (APENAS para feedback funcional, NUNCA como categorias visuais)
| Token | Valor | Uso |
|---|---|---|
| `status-success` | [hex] | Confirmado, sucesso — APENAS quando comunicando resultado positivo |
| `status-error` | [hex] | Erro, cancelado — APENAS quando comunicando problema |
| `status-warning` | [hex] | Pendente, atenção — APENAS quando comunicando alerta |

### Bordas
| Token | Valor | Uso |
|---|---|---|
| `border-default` | [valor] | Contornos padrão |
| `border-subtle` | [valor] | Contornos sutis |

### Geometria
| Token | Valor | Uso |
|---|---|---|
| `radius-card` | [px] | Cards |
| `radius-button` | [px] | Botões |
| `radius-input` | [px] | Inputs |

### Sombras
| Token | Valor | Uso |
|---|---|---|
| `shadow-card` | [valor] | Cards |
| `shadow-hover` | [valor] | Hover |
| `shadow-float` | [valor] | Nav/modais |

---

## Componentes Shadcn — Overrides

| Componente | Override (usando tokens) |
|---|---|
| `<Card>` | `[tokens]` |
| `<Button>` | `[tokens]` |
| `<Badge>` | `[tokens]` |
| `<Avatar>` | `[tokens]` |
| `<Input>` | `[tokens]` |

---

## Regra de Ouro

Ao criar qualquer tela ou componente:
1. Siga TODAS as decisões de identidade (estrutura + linguagem + riqueza visual)
2. Use shadcn/ui como base, customizado via className
3. APENAS tokens semânticos — nunca valores crus
4. UMA cor accent para tudo — a interface inteira usa base neutra (light ou dark) + a cor primária da marca. Nenhuma outra cor vibrante
5. Componentes importantes DEVEM ter CONCEITO VISUAL — uma ilustração/cena SVG original que conta a história do que o componente representa
6. NÃO substitua conceito por decoração genérica — blobs, dot grids e partículas são textura ambiente, não identidade
7. A IA implementadora é RESPONSÁVEL por criar SVGs e composições visuais ORIGINAIS baseadas nas descrições de cena
8. [FRASE: a alma do app em 1 linha]

## Teste Final
Coloque a interface ao lado de um dashboard shadcn padrão. A diferença deve ser óbvia em TRÊS níveis:
- ESTRUTURA: layout/navegação diferentes
- LINGUAGEM: tipografia/geometria/ícones com personalidade + UMA cor forte de marca (não arco-íris)
- RIQUEZA: cada card importante tem uma ilustração conceitual ÚNICA que conta a história do que ele representa — não decoração genérica que poderia estar em qualquer app

Se os cards tiverem blobs e dot grids mas NÃO tiverem conceitos visuais únicos, está INCOMPLETO.
Se a interface usar 4+ cores vibrantes ao invés de UMA cor de marca + neutros, está ERRADO.
```

---

## REGRAS PARA A IA QUE GERA ESTE DOCUMENTO

1. **CONCEITO > DECORAÇÃO.** Nunca sugira "adicione um blob" ou "coloque partículas". Sempre pergunte: "Qual cena visual conta a HISTÓRIA deste componente?" e descreva essa cena.
2. **UMA COR, UMA MARCA.** A paleta DEVE ter apenas UMA cor accent forte. Não crie arco-íris de categorias. Supabase = verde. CoffeeStack = laranja. Seu app = UMA cor. Tudo mais é neutro. Gradientes em tudo não é identidade — é barulho.
3. **DESCREVA, NÃO CODIFIQUE.** O documento de identidade NÃO deve conter blocos de código. Descreva as cenas visuais com palavras detalhadas — a IA que implementa traduz em código. Código pronto vira template; descrição vira criação.
4. **4 PASSOS POR COMPONENTE.** Para cada componente importante: (1) O que REPRESENTA, (2) Qual METÁFORA VISUAL, (3) É viável em código puro?, (4) Descreva a CENA com detalhe.
5. **FORME > COR.** Se as únicas diferenças forem hex codes, FALHOU.
6. **TEMPERO SIMPLES MAS CONCEITUAL.** Um avião tracejado em arco sobre um card de progresso é simples E conceitual. Um blob gradiente atrás de um número é simples mas genérico. Prefira o primeiro.
7. **PESQUISE VIABILIDADE.** Antes de descrever um conceito visual, pergunte se a IA consegue criar em SVG/CSS puro. Se não, simplifique o conceito (versão wireframe) ou marque como asset externo.
8. **DETALHE AS CENAS.** "Adicione um SVG decorativo" é vago e vai virar lixo. "Uma rota tracejada em arco de 180°, partindo de um círculo de 8px (cidade de origem) até um círculo de 12px (destino), com um triângulo de 6px (avião) posicionado a 25% do arco, apontando na direção do caminho. Opacidade geral: 8%. Cor: accent-primary. O destino pulsa sutilmente (scale 1.0 → 1.1 em loop de 2s)." Esse nível de detalhe gera resultado.
9. **Não assuma padrões.** Sidebar, tabela, Inter, ícones Lucide soltos — nada é obrigatório.
10. **Tokens semânticos.** Nomes com intenção (accent-primary, surface-card, radius-card). Valor definido uma vez. No código, só o token.
11. **Escolha momentos.** Não decore tudo — escolha 4-6 componentes de alto impacto e crie conceitos visuais. O contraste entre componentes ricos e componentes limpos É a identidade.