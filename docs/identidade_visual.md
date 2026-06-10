# IDENTIDADE VISUAL — Scriptura (Bíblia de Estudo)

## Stack Técnica

- **Tailwind CSS (NativeWind / React Native Styling):** Para toda a estilização visual no ambiente móvel, garantindo renderização rápida e consistente.
- **Componentes Customizados Mobile (estilo shadcn):** Blocos de interface altamente polidos construídos com Tailwind utilitário para ambiente móvel (Android & iOS).
- **Tokens Semânticos de Design:** Todos os valores visuais (cores de fundo, texto, acentos, geometria e sombras) mapeados em constantes reutilizáveis (`tailwind.config.js`).
- **Navegação & UI Isolada:** Navegação livre de internet (off-line), focada no silêncio e na imersão intelectual, sem pop-ups, banners ou ruídos.
- **Riqueza Baseada em Vetores (SVG):** A IA implementadora deve criar composições visuais geométricas originais em código SVG ou formas CSS correspondentes às cenas descritas abaixo — **proibido o uso de decorações vazias** (como *gradient blobs* genéricos, dot grids aleatórios ou partículas flutuantes).
- **A Regra da Cor Única:** O aplicativo utiliza **apenas UMA cor de destaque (Covenant Blue)**. Toda a interface restante é estruturada em tons neutros sofisticados e calmos.

---

## Setup Necessário

### Libs adicionais recomendadas (Mobile)
| Lib | Pra quê | Instalação |
|---|---|---|
| `react-native-svg` | Renderização nativa e ultra-rápida das cenas de SVG e ilustrações conceituais | `npx expo install react-native-svg` |
| `moti` ou `framer-motion` | Micro-interações e transições de layouts fluidas e calmas | `npm i moti react-native-reanimated` |

---

## A Alma do App

> **"Um santuário de estudo pessoal na palma da sua mão."**
> O Scriptura não é um leitor casual ou uma rede social teológica. É uma ferramenta de precisão acadêmica e recolhimento pessoal, projetada para funcionar 100% off-line. Cada elemento da interface inspira silêncio, foco, reverência e profundidade intelectual na análise das Escrituras Sagradas.

---

## Referências e Princípios

- **Cambridge Typography:** A sobriedade, legibilidade e distribuição clássica de Bíblias de estudo acadêmicas de alta costura → *Princípio:* Uso de fontes com serifa de altíssima legibilidade para o texto bíblico, amplos respiros e margens generosas.
- **Linear Precision:** O minimalismo rigoroso, focado e de alta performance das ferramentas de produtividade contemporâneas → *Princípio:* Bordas cirúrgicas, linhas finas de divisão, ausência completa de sombras pesadas ou decorações desnecessárias.
- **Substack Focus:** A imersão absoluta na leitura prolongada livre de notificações ou distrações externas → *Princípio:* A interface recolhe-se e desaparece à medida que o usuário rola o texto, deixando apenas a palavra e as suas anotações marginais.

---

## Decisões de Identidade

### ESTRUTURA (Camada 1)

#### Navegação por Abas (Bottom Dock)
**O que:** Uma barra inferior discreta com ícones minimalistas de traço fino, sem labels, que desliza sutilmente para fora da tela durante a leitura ativa.
**Por que:** Maxima área de tela dedicada ao texto sagrado, eliminando distrações visuais constantes.
**Como:** Posicionamento absoluto no rodapé do dispositivo, fundo translúcido sutil que acompanha o tema, e indicador ativo na cor do token `accent-primary` por meio de uma linha horizontal de 2px de altura.
**Nunca:** Usar cores vibrantes na barra inteira ou labels grandes que causem poluição visual.

#### Split-Screen & Comparador Multi-Verso
**O que:** Um layout adaptável de colunas que divide a tela verticalmente (ou horizontalmente) para exibir e sincronizar 2 ou 3 traduções bíblicas simultaneamente (ARA, ARC, KJV, Darby).
**Por que:** Facilita a comparação literária instantânea sem forçar o usuário a alternar de tela.
**Como:** Grid flexível com divisor central (`border-subtle`) extremamente fino. O scroll de uma coluna opcionalmente tranca e sincroniza a outra no mesmo versículo.
**Nunca:** Usar divisores coloridos grossos ou animações abruptas de transição.

---

### LINGUAGEM (Camada 2)

#### Tipografia
**O que:** Contraste intencional entre duas famílias de fontes. O texto bíblico principal utiliza uma fonte Serifada robusta e elegante (ex: *Merriweather* ou *Lora*). Toda a interface de controle, dicionários e notas utiliza uma fonte Sans-serif técnica e limpa (ex: *Inter*).
**Por que:** A fonte serifada acalma a leitura e garante conforto ocular para longos períodos de estudo. A sans-serif indica claramente o que é "ferramenta/metadado" e o que é "texto sagrado".
**Como:** Texto bíblico: `font-serif text-[18px] leading-relaxed`. Metadados e interface: `font-sans text-[13px] tracking-tight`.
**Nunca:** Usar fontes manuscritas, fontes muito finas que dificultem a leitura em telas pequenas de celular, ou misturar 3 ou mais famílias de fontes.

#### Geometria e Profundidade
**O que:** Cantos ligeiramente arredondados em cards e painéis (estilo editorial de luxo) combinados com bordas extremamente sutis e profundidade plana, quase sem sombras.
**Por que:** Cria uma estética clássica de encadernação de couro e páginas sem o peso de designs corporativos cheios de elevação 3D exagerada.
**Como:** `radius-card` definido como `8px`. Bordas finas de `1px` em `border-default` ou `border-subtle` com sombras nulas ou extremamente suaves (`shadow-card` com opacidade de no máximo 2% no light mode).
**Nunca:** Usar cantos extremamente redondos (estilo mobile infantil) ou gradientes de profundidade coloridos em painéis de estudo.

---

### RIQUEZA VISUAL (Camada 3)

#### Textura Ambiente
**O que:** Uma textura de fundo que simula sutilmente papel bíblico clássico e a estrutura do cânon bíblico.
**Temática:** Conecta o leitor à tradição física dos livros e ao recolhimento.
**Tratamento:** No Light Mode, um tom sépia/creme sutilíssimo com uma textura microscópica de grão analógico (noise de 2% de opacidade). No Dark Mode, um tom de carvão profundo com linhas de grade horizontais e verticais finíssimas (1px, opacidade de 3%), evocando uma sensação de biblioteca noturna acolhedora e precisa.

#### Conceitos Visuais por Componente

##### 1. Painel de Comparação de Versões (Version Comparator Panel)
- **Representa:** O alinhamento literário e a riqueza linguística entre traduções da palavra sagrada.
- **Metáfora visual:** Dois rolos de pergaminho antigo estendidos em perfeita simetria paralela.
- **Cena detalhada:** Uma composição SVG composta por duas colunas verticais perfeitamente alinhadas lado a lado. No topo e na base de cada coluna, há curvas ovais que simulam a borda enrolada de um pergaminho antigo de couro. Linhas horizontais finas e curtas de opacidade muito baixa (5%) simulam linhas de texto. Onde o versículo atualmente selecionado está localizado, um bloco retangular sutil na cor `accent-primary` (com apenas 8% de opacidade) envolve horizontalmente as duas colunas, conectado por uma linha central tracejada de 1px. Isso ilustra visualmente a unificação das duas traduções sobre a mesma raiz literária.
- **Viabilidade:** CÓDIGO PURO (SVG inline / Shapes CSS).

##### 2. Rede de Correlação e Links de Versículos (Scripture Linker)
- **Representa:** O entrelaçamento de ideias teológicas e referências cruzadas criadas pessoalmente pelo estudante.
- **Metáfora visual:** Âncoras e nós de uma constelação intelectual interconectada.
- **Cena detalhada:** Três pequenos círculos (nós) flutuando no espaço em uma disposição triangular irregular. Cada nó exibe uma referência abreviada em texto pequeno de opacidade média (ex: "Gn 1:1", "Jo 1:1" e "1Jo 1:1"). Uma linha em arco com efeito pontilhado de costura conecta os três nós. No centro geométrico onde as linhas se aproximam, há um pequeno elo ou âncora minimalista desenhada com linhas finas e preenchida com a cor `accent-primary`. Os nós possuem anéis concêntricos que pulsa sutilmente em opacidades baixas (15% a 5%), dando vida de forma calma à correlação intelectual e espiritual feita pelo usuário.
- **Viabilidade:** CÓDIGO PURO (SVG inline).

##### 3. Dicionário de Idiomas Originais (Hebrew/Greek Lexicon)
- **Representa:** A busca pela verdade original escavada por trás das traduções modernas.
- **Metáfora visual:** Inscrições de pedra arqueológica reveladas através de uma lente de estudo focalizada.
- **Cena detalhada:** Uma sobreposição de planos. No plano de fundo, há formas retangulares em relevo de borda fina que simulam placas de pedra antiga. Glifos simplificados dos alfabetos grego antigo (como α, Ω, χ) ou caracteres hebraicos são desenhados de forma linear com opacidade muito baixa (8%). À frente dessa parede de pedra, posiciona-se uma forma circular translúcida perfeita que simula uma lente de aumento. A borda da lente é desenhada com traço duplo sutil. Dentro da área circular da lente, a palavra original analisada brilha sutilmente na cor sólida `accent-primary` (Covenant Blue) e dela partem linhas explicativas em direção ao rodapé.
- **Viabilidade:** CÓDIGO PURO (SVG inline + CSS blur translúcido).

##### 4. Sistema de Busca Duplo e Hemisférios (Dual Search Engine)
- **Representa:** A bússola de navegação exata nos textos e a exploração de frases esquecidas.
- **Metáfora visual:** Uma bússola teológica dividida em dois hemisférios representando o Velho Testamento (Antigo) e o Novo Testamento.
- **Cena detalhada:** Um círculo externo perfeito que simula o corpo de uma bússola de bolso clássica. O círculo é dividido exatamente ao meio por um eixo vertical muito fino. O hemisfério esquerdo representa o Velho Testamento e é decorado com uma espiral geométrica sutil composta por 39 pequenos pontos neutros (simbolizando os 39 livros). O hemisfério direito representa o Novo Testamento, desenhado com uma espiral composta por 27 pontos na cor ativa `accent-primary` (azul). A agulha central da bússola é estilizada com traço duplo; quando o usuário executa uma busca rápida de livro (ex: "Mateus 4:3"), a agulha aponta na direção do Novo Testamento. Quando faz uma busca de termo genérico com filtros ativos, o círculo emite ondas circulares concêntricas discretas que se dissipam em direção às bordas.
- **Viabilidade:** CÓDIGO PURO (SVG inline).

##### 5. Caderno de Notas do Estudante (Personal Study Journal)
- **Representa:** O diário silencioso das revelações pessoais e anotações ativas.
- **Metáfora visual:** A folha de pergaminho ou couro de um caderno clássico com uma fita marcadora de páginas.
- **Cena detalhada:** Um retângulo vertical que emula a folha limpa de um caderno. Linhas horizontais perfeitamente paralelas e finas cortam o retângulo, representando as linhas de escrita. No canto superior direito da página, uma fita marcadora de páginas vertical cai sutilmente até o meio da página. Essa fita é preenchida inteiramente com o tom nobre da cor `accent-primary`, terminando com um corte triangular clássico em sua base. No canto inferior da página, um pequeno círculo minimalista com relevo sutil representa um selo de cera ou brasão, conferindo um ar histórico e inteiramente pessoal ao caderno de anotações off-line.
- **Viabilidade:** CÓDIGO PURO (Shapes CSS + SVG inline).

##### 6. Biblioteca de Versões Off-line (Local Scripture Library)
- **Representa:** A segurança da autonomia física e a posse definitiva dos textos sagrados, independentemente de conexão.
- **Metáfora visual:** Uma prateleira de madeira sólida guardando tomos clássicos encadernados.
- **Cena detalhada:** Uma linha horizontal mais espessa de cor neutra escura serve como suporte básico (a prateleira). Apoiados sobre ela, há quatro retângulos verticais dispostos lado a lado com alturas e larguras ligeiramente diferentes, representando os volumes físicos das quatro versões instaladas (ARA, ARC, Darby, KJV). As lombadas dos retângulos possuem linhas horizontais clássicas simulando os relevos da encadernação. O volume principal exibe uma elegante linha de destaque vertical na cor `accent-primary`. No canto da prateleira, um pequeno círculo de 8px com um check-mark interno estilizado em vetor sutil sinaliza que todos os arquivos de dados estão localizados no armazenamento físico do dispositivo e prontos para uso off-line permanente.
- **Viabilidade:** CÓDIGO PURO (Shapes CSS / SVG).

---

## Tokens de Design

### Cores — Fundos (Base Sépia Luxo & Carvão)

| Token | Valor (Light) | Valor (Dark) | Uso |
|---|---|---|---|
| `surface-page` | `#FAF7F2` | `#0F0E0D` | Fundo principal do app (sépia claro / carvão escuro) |
| `surface-card` | `#FFFFFF` | `#1A1817` | Fundo de cards, notas e modais de estudo |
| `surface-elevated`| `#F2EDE4` | `#242120` | Painéis elevados, cabeçalhos ou menus ativados |

### Cores — Texto (Contraste Suave)

| Token | Valor (Light) | Valor (Dark) | Uso |
|---|---|---|---|
| `text-primary` | `#1A1613` | `#F2EFEA` | Títulos e Versículos principais (Charcoal quente / Creme) |
| `text-secondary` | `#5C534C` | `#A69E96` | Comentários e referências secundárias |
| `text-muted` | `#8C8177` | `#706861` | Legendas, datas e marcas temporais de notas |

### Cores — Accent (Covenant Blue — Apenas UMA cor de destaque)

| Token | Valor Hex | Uso |
|---|---|---|
| `accent-primary` | `#1E40AF` | **Royal Covenant Blue** — A única cor forte do app. Usada apenas para botões ativos, versículos destacados sob seleção, links entre versículos, fita marcadora de notas e agulha de busca. |
| `accent-hover` | `#1D4ED8` | Estado ativo pressionado ou selecionado do Covenant Blue |
| `accent-subtle` | `rgba(30, 64, 175, 0.08)` | Fundo translúcido sutil de versículos selecionados ou badges de filtros |

### Cores — Status (Apenas funcional para feedbacks reais do dispositivo)

| Token | Valor Hex | Uso |
|---|---|---|
| `status-success` | `#15803D` | Indicação de download de versão completo ou nota salva com sucesso |
| `status-error` | `#B91C1C` | Falha ao tentar importar um arquivo local de versão ou apagar anotação |
| `status-warning` | `#B45309` | Espaço em disco baixo ou pendência ao reverter vinculação |

### Geometria & Bordas

| Token | Valor | Uso |
|---|---|---|
| `border-default` | `1px solid` | Linhas finas separadoras de painéis teológicos |
| `border-subtle` | `0.5px solid` | Divisores de versículos paralelos na leitura sincronizada |
| `radius-card` | `8px` | Bordas levemente suavizadas para painéis e cards de anotação |
| `radius-button` | `6px` | Botões de ação discretos de ferramentas |
| `radius-pill` | `9999px` | Badges de filtros de testamentos (VT / NT) ou versões ativas |

### Sombras e Atmosfera (Editorial Sem Peso)

| Token | Valor (Light) | Valor (Dark) | Uso |
|---|---|---|---|
| `shadow-card` | `0 2px 8px rgba(26,22,19, 0.02)` | Nula | Sombras extremamente imperceptíveis, valorizando a limpeza editorial |
| `shadow-elevated` | `0 4px 16px rgba(26,22,19, 0.04)` | `0 4px 16px rgba(0,0,0, 0.4)` | Modais suspensos ou folhas de dicionário que sobem da base |

---

## Overrides de Componentes Mobílias

| Componente | Customização com Tokens |
|---|---|
| **Página de Leitura (`<Container>`)** | Fundo definido inteiramente por `surface-page` com fonte `font-serif` para os textos. |
| **Cards de Notas/Comentários (`<Card>`)** | Borda fina em `border-default`, fundo `surface-card`, sem sombras, radius em `radius-card`. |
| **Badges de Filtro (`<Badge>`)** | Se ativo, fundo `accent-subtle` e texto `accent-primary` sem bordas. Se inativo, fundo neutro em `surface-elevated` e texto `text-secondary`. |
| **Botões de Ação (`<Button>`)** | Primário sutil com contorno linear fino em `accent-primary` e texto `accent-primary` (mantendo a sobriedade), evitando botões inteiramente coloridos de forma exagerada. |
| **Campos de Busca (`<Input>`)** | Fundo em `surface-card`, borda fina em `border-default`, raio em `radius-button`, texto ativo em `text-primary`. |

---

## Regra de Ouro

Ao desenhar ou codificar qualquer elemento da interface do Scriptura:
1. **Rigor off-line absoluto:** Toda a interface e transição visual devem ser calculadas localmente, sem esperar respostas de rede.
2. **Uso pontual do Covenant Blue:** O azul forte do aplicativo aparece apenas como um ponto de luz intencional (acertos de botões selecionados, versículos linkados e o marcador de notas). Todo o restante deve ser calmo e neutro.
3. **Tipografia Sagrada:** O texto bíblico principal tem o trono da interface — ele é serifado, com espaçamento amplo (`leading-relaxed`), e as referências numéricas de capítulos são mantidas em tom `text-muted` discreto.
4. **Cenas Conceituais no lugar de Enfeites:** Se um card ou aba precisar de apelo visual, implemente estritamente as descrições dos 6 conceitos visuais desenhados em SVG/CSS. **Não coloque gradientes coloridos ou poeira digital decorativa.**
5. **Legibilidade Noturna:** O Dark Mode deve ser testado para assegurar que a luz emitida pelo celular seja mínima e confortável para leitura em ambientes completamente escuros.
6. **Frase de Alma:** *"Um santuário pessoal de sabedoria e estudo profundo, sem distrações e 100% sob seu controle."*

---

## Teste Final de Identidade

Compare a tela do Scriptura com um leitor de e-books genérico ou um aplicativo de tarefas comercial:
- **ESTRUTURA:** A diferença deve ser imediata na capacidade de comparar 2 ou 3 colunas de versões alinhadas e no surgimento do painel de correlação em arco entre versículos.
- **LINGUAGEM:** A transição suave entre a fonte serifada literária (texto bíblico) e a sans-serif técnica (dicionários e referências) confere um visual imediatamente acadêmico.
- **RIQUEZA:** Cada momento importante do app (Pesquisa de Hemisférios, Léxico de Pedra, Biblioteca Física) apresenta uma ilustração conceitual geométrica em vetor linear discreto com a cor Covenant Blue pontual, contando a história do estudo físico e sagrado.
