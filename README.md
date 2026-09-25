<div align="center">

<img src="./assets/geass-symbol.gif" alt="Símbolo animado do Geass" width="100%">

<sub>Símbolo por <a href="https://commons.wikimedia.org/wiki/User:Koveras">Koveras</a>, adaptado sob <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>.</sub>

# Geass Requiem

Uma dupla de temas para **Visual Studio Code** inspirada em rebelião, estratégia,
realeza e no brilho sobrenatural do Geass.

[![Marketplace](https://img.shields.io/visual-studio-marketplace/v/davi-noah.geass-requiem-theme?style=flat-square&label=marketplace&color=B93C66)](https://marketplace.visualstudio.com/items?itemName=davi-noah.geass-requiem-theme)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/davi-noah.geass-requiem-theme?style=flat-square&color=D7A84B)](https://marketplace.visualstudio.com/items?itemName=davi-noah.geass-requiem-theme)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/davi-noah.geass-requiem-theme?style=flat-square&color=67458F)](https://marketplace.visualstudio.com/items?itemName=davi-noah.geass-requiem-theme)
[![VS Code](https://img.shields.io/badge/VS_Code-%5E1.80.0-37233E?style=flat-square&logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-D7A84B?style=flat-square)](./LICENSE)

</div>

> Dois lados do mesmo império: a escuridão carmesim da rebelião e a elegância
> marfim de Britannia — com cores de interface, terminal e sintaxe pensadas como
> um único sistema visual.

## Temas

### Rebellion

Um tema escuro de alto contraste com fundo negro-violeta, carmesim, ouro e
lavanda. Feito para sessões longas sem perder a presença dramática.

### Holy Britannia

Um tema claro de fundo marfim, vinho imperial, ouro envelhecido e violeta.
Mantém a mesma hierarquia visual de Rebellion sob uma luz mais nobre.

## Instalação

### Pelo Marketplace

1. Abra o [Geass Requiem no Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=davi-noah.geass-requiem-theme).
2. Clique em **Install**.
3. No VS Code, execute **Preferences: Color Theme**.
4. Escolha **Geass Requiem: Rebellion** ou **Geass Requiem: Holy Britannia**.

### Pelo terminal

```bash
code --install-extension davi-noah.geass-requiem-theme
```

Também é possível procurar por `Geass Requiem` diretamente na aba de extensões
do VS Code.

## Paleta de cores

### Rebellion

| Cor | Hex | Uso | Amostra |
| --- | --- | --- | --- |
| Night | `#1B1621` | Fundo do editor | ![#1B1621](https://placehold.co/54x24/1B1621/1B1621) |
| Ivory | `#E9E3EE` | Texto principal | ![#E9E3EE](https://placehold.co/54x24/E9E3EE/E9E3EE) |
| Geass | `#F05A82` | Palavras-chave | ![#F05A82](https://placehold.co/54x24/F05A82/F05A82) |
| Imperial Gold | `#E7BC5D` | Funções e destaques | ![#E7BC5D](https://placehold.co/54x24/E7BC5D/E7BC5D) |
| Lavender | `#C9A8F2` | Strings | ![#C9A8F2](https://placehold.co/54x24/C9A8F2/C9A8F2) |
| Britannian Blue | `#9FC4F0` | Tipos e classes | ![#9FC4F0](https://placehold.co/54x24/9FC4F0/9FC4F0) |
| Jade | `#80CEB0` | Propriedades | ![#80CEB0](https://placehold.co/54x24/80CEB0/80CEB0) |
| Crimson | `#FF5470` | Erros | ![#FF5470](https://placehold.co/54x24/FF5470/FF5470) |

### Holy Britannia

| Cor | Hex | Uso | Amostra |
| --- | --- | --- | --- |
| Porcelain | `#FFFDF9` | Fundo do editor | ![#FFFDF9](https://placehold.co/54x24/FFFDF9/FFFDF9) |
| Royal Ink | `#312B35` | Texto principal | ![#312B35](https://placehold.co/54x24/312B35/312B35) |
| Geass | `#A51F4B` | Palavras-chave | ![#A51F4B](https://placehold.co/54x24/A51F4B/A51F4B) |
| Antique Gold | `#75520A` | Funções e destaques | ![#75520A](https://placehold.co/54x24/75520A/75520A) |
| Imperial Violet | `#67458F` | Strings | ![#67458F](https://placehold.co/54x24/67458F/67458F) |
| Britannian Blue | `#315F91` | Tipos e classes | ![#315F91](https://placehold.co/54x24/315F91/315F91) |
| Jade | `#24705B` | Propriedades | ![#24705B](https://placehold.co/54x24/24705B/24705B) |
| Crimson | `#B91F42` | Erros | ![#B91F42](https://placehold.co/54x24/B91F42/B91F42) |

## Desenvolvimento

1. Clone ou abra este repositório no VS Code.
2. Pressione `F5` para iniciar uma janela de desenvolvimento de extensão.
3. Nessa janela, execute **Preferences: Color Theme**.
4. Selecione **Geass Requiem: Rebellion** ou **Geass Requiem: Holy Britannia**.

As cores da interface, do terminal e da sintaxe ficam em [`themes/`](./themes/).
Depois de alterar um tema, recarregue a janela de desenvolvimento para conferir o
resultado.

### Gerar o pacote

```bash
npm run package
```

O comando gera um arquivo `.vsix` pronto para instalação.

## Contribuindo

Contribuições são bem-vindas. Para propor uma correção ou melhorar uma cor:

1. Crie um fork e uma branch para a mudança.
2. Ajuste o arquivo correspondente em [`themes/`](./themes/).
3. Teste os dois temas em uma janela de desenvolvimento com `F5`.
4. Abra um pull request explicando a motivação da alteração.

Ao mexer na paleta, preserve legibilidade, contraste e consistência entre os
equivalentes claro e escuro.

## Acessibilidade

As cores foram escolhidas para manter uma hierarquia legível em fundos claros e
escuros. Como extensões, linguagens e configurações do editor podem alterar o
realce final, contribuições com melhorias de contraste são especialmente úteis.

## Aviso

Este é um projeto independente, inspirado na atmosfera de *Code Geass*, e não
possui associação com os detentores da obra original. Nomes, personagens e marcas
citados pertencem aos seus respectivos titulares.

### Crédito das imagens

O GIF e o ícone da extensão são adaptações de
“[Geass.svg](https://commons.wikimedia.org/wiki/File:Geass.svg)”, criado por
[Koveras](https://commons.wikimedia.org/wiki/User:Koveras) e licenciado sob
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). As adaptações
adicionam fundo, recoloração e brilho; o GIF também inclui scanlines sutis e um
pulso lento. Ambas são distribuídas sob a mesma licença. Consulte
[`assets/LICENSE.md`](./assets/LICENSE.md).

Essas imagens não fazem parte da licença MIT aplicada ao código deste projeto.

## Changelog

Veja o histórico de versões em [`CHANGELOG.md`](./CHANGELOG.md).

## Licença

[MIT](./LICENSE) © Geass Requiem contributors.
