const vscode = require('vscode');

class GeassCompanionProvider {
  static viewType = 'geassRequiem.companionView';

  constructor(context) {
    this.context = context;
    this.view = undefined;
    this.pendingAwakening = false;
    this.lastReactionAt = 0;
    this.lastAffinityAt = 0;
    this.diagnosticCounts = new Map();
    const storedPomodoro = context.globalState.get('geassRequiem.pomodoroState', {});
    const legacyFocusEnd = context.globalState.get('geassRequiem.focusEndsAt');
    const storedFocusEnd = storedPomodoro.endsAt || legacyFocusEnd;
    this.focusPhase = ['focus', 'shortBreak', 'longBreak'].includes(storedPomodoro.phase)
      ? storedPomodoro.phase
      : 'focus';
    this.completedFocuses = Math.max(0, Number(storedPomodoro.completedFocuses) || 0);
    this.focusEndsAt = Number.isFinite(storedFocusEnd) && storedFocusEnd > Date.now()
      ? storedFocusEnd
      : undefined;
    this.focusTimer = undefined;
    if (this.focusEndsAt) this.scheduleFocusCompletion();
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(
      (event) => {
        if ((event.affectsConfiguration('geassRequiem.focusMode') || event.affectsConfiguration('geassRequiem.companionFeatures')) && !this.isFocusEnabled()) {
          void this.stopFocus(true);
        }
        if (event.affectsConfiguration('geassRequiem')) this.render();
      }
    ));
  }

  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'assets')]
    };
    view.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'changeCharacter') {
        await vscode.workspace.getConfiguration('geassRequiem').update(
          'character', message.value, vscode.ConfigurationTarget.Global
        );
      }
      if (message.type === 'changeScene') {
        await vscode.workspace.getConfiguration('geassRequiem').update(
          'scene', message.value, vscode.ConfigurationTarget.Global
        );
      }
      if (message.type === 'startFocus') await this.startFocus(undefined, message.phase);
      if (message.type === 'stopFocus') await this.stopFocus();
      if (message.type === 'companionInteraction') await this.awardAffinity(1, 12000);
      if (message.type === 'rareEvent') await this.awardAffinity(3, 0);
    }, null, this.context.subscriptions);
    this.render();
    if (this.pendingAwakening) this.awaken();
  }

  awaken() {
    this.pendingAwakening = !this.view;
    this.view?.webview.postMessage({ type: 'awaken' });
  }

  isFocusEnabled() {
    const config = vscode.workspace.getConfiguration('geassRequiem');
    return config.get('companionFeatures', true) && config.get('focusMode', true);
  }

  pomodoroConfig() {
    const config = vscode.workspace.getConfiguration('geassRequiem');
    return {
      focus: Math.max(1, Math.min(180, config.get('focusDuration', 25))),
      shortBreak: Math.max(1, Math.min(60, config.get('shortBreakDuration', 5))),
      longBreak: Math.max(1, Math.min(120, config.get('longBreakDuration', 15))),
      sessionsBeforeLongBreak: Math.max(1, Math.min(12, config.get('focusSessionsBeforeLongBreak', 4))),
      autoStartBreaks: config.get('pomodoroAutoStartBreaks', false),
      autoStartFocus: config.get('pomodoroAutoStartFocus', false),
      notifications: config.get('pomodoroNotifications', true)
    };
  }

  async persistPomodoroState() {
    await this.context.globalState.update('geassRequiem.pomodoroState', {
      phase: this.focusPhase,
      completedFocuses: this.completedFocuses,
      endsAt: this.focusEndsAt || null
    });
    await this.context.globalState.update('geassRequiem.focusEndsAt', undefined);
  }

  async startFocus(minutes, requestedPhase) {
    if (!this.isFocusEnabled()) {
      vscode.window.showInformationMessage('Ative o Modo foco nas configurações do Geass Requiem.');
      return;
    }
    const settings = this.pomodoroConfig();
    const phase = ['focus', 'shortBreak', 'longBreak'].includes(requestedPhase)
      ? requestedPhase
      : this.focusPhase;
    this.focusPhase = phase;
    const configuredMinutes = settings[phase];
    const maximum = phase === 'focus' ? 180 : 120;
    const duration = Math.max(1, Math.min(maximum, Number(minutes) || configuredMinutes));
    this.focusEndsAt = Date.now() + duration * 60 * 1000;
    await this.persistPomodoroState();
    await vscode.commands.executeCommand('setContext', 'geassRequiem.focusActive', true);
    this.scheduleFocusCompletion();
    this.sendFocusState();
    this.say(getPomodoroMessage(this.currentCharacter(), 'start', phase, duration), phase === 'focus' ? 'focused' : 'calm');
  }

  async stopFocus(silent = false) {
    clearTimeout(this.focusTimer);
    this.focusTimer = undefined;
    const wasActive = Boolean(this.focusEndsAt);
    this.focusEndsAt = undefined;
    await this.persistPomodoroState();
    await vscode.commands.executeCommand('setContext', 'geassRequiem.focusActive', false);
    this.sendFocusState();
    if (wasActive && !silent) this.say(getPomodoroMessage(this.currentCharacter(), 'stop', this.focusPhase), 'calm');
  }

  scheduleFocusCompletion() {
    clearTimeout(this.focusTimer);
    if (!this.focusEndsAt) return;
    const remaining = Math.max(0, this.focusEndsAt - Date.now());
    this.focusTimer = setTimeout(() => void this.completeFocus(), remaining);
  }

  async completeFocus() {
    const completedPhase = this.focusPhase;
    const settings = this.pomodoroConfig();
    clearTimeout(this.focusTimer);
    this.focusTimer = undefined;
    this.focusEndsAt = undefined;
    await vscode.commands.executeCommand('setContext', 'geassRequiem.focusActive', false);
    if (completedPhase === 'focus') {
      this.completedFocuses += 1;
      this.focusPhase = this.completedFocuses % settings.sessionsBeforeLongBreak === 0
        ? 'longBreak'
        : 'shortBreak';
      await this.persistPomodoroState();
      this.say(getPomodoroMessage(this.currentCharacter(), 'complete', 'focus'), 'celebrating');
      await this.awardAffinity(5, 0);
      if (settings.notifications) {
        vscode.window.showInformationMessage(`Foco concluído. ${this.focusPhase === 'longBreak' ? 'Pausa longa' : 'Pausa curta'} disponível.`);
      }
      if (settings.autoStartBreaks) {
        await this.startFocus(undefined, this.focusPhase);
        return;
      }
    } else {
      if (completedPhase === 'longBreak') this.completedFocuses = 0;
      this.focusPhase = 'focus';
      await this.persistPomodoroState();
      this.say(getPomodoroMessage(this.currentCharacter(), 'complete', completedPhase), 'confident');
      if (settings.notifications) vscode.window.showInformationMessage('Pausa concluída. A próxima sessão de foco está pronta.');
      if (settings.autoStartFocus) {
        await this.startFocus(undefined, 'focus');
        return;
      }
    }
    this.sendFocusState();
  }

  sendFocusState() {
    this.view?.webview.postMessage({
      type: 'focusState',
      endsAt: this.focusEndsAt || null,
      phase: this.focusPhase,
      completedFocuses: this.completedFocuses,
      settings: this.pomodoroConfig()
    });
  }

  currentCharacter() {
    return vscode.workspace.getConfiguration('geassRequiem').get('character', 'zero');
  }

  say(message, mood) {
    if (!message) return;
    const config = vscode.workspace.getConfiguration('geassRequiem');
    const moodsEnabled = config.get('companionFeatures', true) && config.get('emotionalStates', true);
    this.view?.webview.postMessage({
      type: 'reaction',
      message,
      mood: moodsEnabled ? mood : undefined
    });
  }

  affinityEnabled() {
    const config = vscode.workspace.getConfiguration('geassRequiem');
    return config.get('companionFeatures', true) && config.get('affinitySystem', false);
  }

  affinityFor(character = this.currentCharacter()) {
    const affinity = this.context.globalState.get('geassRequiem.affinity', {});
    const points = Number(affinity[character]) || 0;
    const thresholds = [0, 10, 25, 50, 90];
    let level = 1;
    thresholds.forEach((threshold, index) => {
      if (points >= threshold) level = index + 1;
    });
    const nextThreshold = thresholds[level] || null;
    return { points, level, nextThreshold };
  }

  async awardAffinity(amount, cooldown = 45000) {
    if (!this.affinityEnabled()) return;
    const now = Date.now();
    if (cooldown && now - this.lastAffinityAt < cooldown) return;
    this.lastAffinityAt = now;
    const character = this.currentCharacter();
    const before = this.affinityFor(character);
    const affinity = this.context.globalState.get('geassRequiem.affinity', {});
    affinity[character] = before.points + amount;
    await this.context.globalState.update('geassRequiem.affinity', affinity);
    const after = this.affinityFor(character);
    this.view?.webview.postMessage({ type: 'affinityState', affinity: after });
    if (after.level > before.level) {
      this.say(getAffinityLevelMessage(character, after.level), 'celebrating');
    }
  }

  reactTo(type) {
    const config = vscode.workspace.getConfiguration('geassRequiem');
    if (!config.get('companionFeatures', true) || !config.get('contextReactions', true)) return;
    const now = Date.now();
    if (now - this.lastReactionAt < 6500) return;
    const message = getContextReaction(this.currentCharacter(), type);
    if (!message) return;
    this.lastReactionAt = now;
    const mood = ['errors', 'taskFailure'].includes(type)
      ? 'concerned'
      : ['errorsCleared', 'taskSuccess'].includes(type)
        ? 'celebrating'
        : 'confident';
    this.say(message, mood);
    void this.awardAffinity(1);
  }

  handleDiagnostics(uri) {
    const key = uri.toString();
    const errors = vscode.languages.getDiagnostics(uri)
      .filter((diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error).length;
    const previous = this.diagnosticCounts.get(key);
    this.diagnosticCounts.set(key, errors);
    if (previous === undefined) return;
    if (previous > 0 && errors === 0) this.reactTo('errorsCleared');
    else if (errors > previous) this.reactTo('errors');
  }

  render() {
    if (!this.view) return;
    const webview = this.view.webview;
    const config = vscode.workspace.getConfiguration('geassRequiem');
    const character = config.get('character', 'zero');
    const scene = config.get('scene', 'geass');
    const frameNames = {
      walk: ['walk-0.png', 'walk-1.png', 'walk-2.png', 'walk-3.png'],
      idle: ['idle-0.png', 'idle-1.png'],
      talk: ['talk-0.png', 'talk-1.png']
    };
    const frames = Object.fromEntries(Object.entries(frameNames).map(([state, names]) => [
      state,
      names.map((name) => webview.asWebviewUri(vscode.Uri.joinPath(
        this.context.extensionUri, 'assets', 'companions', 'frames', character, name
      )).toString())
    ]));
    const sceneBackdrop = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'scenes', `${scene}.webp`)
    ).toString();
    const size = config.get('companionSize', 'medium');
    const motion = config.get('companionMotion', true);
    const focus = {
      enabled: config.get('companionFeatures', true) && config.get('focusMode', true),
      duration: config.get('focusDuration', 25),
      endsAt: this.focusEndsAt || null,
      phase: this.focusPhase,
      completedFocuses: this.completedFocuses,
      settings: this.pomodoroConfig()
    };
    const extrasEnabled = config.get('companionFeatures', true);
    const features = {
      affinity: extrasEnabled && config.get('affinitySystem', false),
      affinityState: this.affinityFor(character),
      emotions: extrasEnabled && config.get('emotionalStates', true),
      advancedInteractions: extrasEnabled && config.get('advancedInteractions', true),
      rareEvents: extrasEnabled && config.get('rareEvents', true),
      rareEventFrequency: config.get('rareEventFrequency', 'rare')
    };
    webview.html = getHtml(webview, frames, sceneBackdrop, character, scene, size, motion, focus, features);
  }
}

const contextReactionSets = {
  zero: {
    save: ['Peça posicionada. Prossiga para o próximo movimento.', 'O progresso foi registrado. O plano continua.'],
    errors: ['Há uma falha no plano. Encontre-a antes que o inimigo encontre.', 'Um erro apareceu. Reavalie a estratégia.'],
    errorsCleared: ['Todas as falhas foram eliminadas. Vitória tática.', 'O caminho está livre novamente.'],
    terminal: ['O campo de operações está aberto.', 'Comandos diretos. Sem movimentos desperdiçados.'],
    taskSuccess: ['A operação foi concluída com sucesso.', 'Resultado confirmado. Exatamente como planejado.'],
    taskFailure: ['A operação falhou. Ajuste o plano e tente novamente.', 'Um revés não encerra a estratégia.']
  },
  cc: {
    save: ['Registrado. Humanos realmente temem perder o próprio trabalho.', 'Mais uma escolha preservada.'],
    errors: ['Seu código está pedindo um contrato melhor.', 'Isso parece problemático. Quase tão problemático quanto ficar sem pizza.'],
    errorsCleared: ['Você resolveu. Talvez eu tenha subestimado sua persistência.', 'O problema desapareceu. Por enquanto.'],
    terminal: ['Vai invocar alguma coisa ou apenas digitar comandos?', 'O terminal está aberto. Tente não fazer um contrato irreversível.'],
    taskSuccess: ['Funcionou. Que final surpreendentemente conveniente.', 'Concluído. Você merece uma pizza.'],
    taskFailure: ['Falhou. A eternidade oferece tempo para tentar novamente.', 'Nem todo contrato entrega o resultado esperado.']
  },
  kallen: {
    save: ['Progresso salvo. Vamos continuar avançando.', 'Tudo registrado. Próximo alvo.'],
    errors: ['Temos problemas na linha de frente.', 'Encontrei uma abertura no código. Vamos corrigir.'],
    errorsCleared: ['Área limpa. Podemos avançar!', 'Boa! Nenhum erro restante.'],
    terminal: ['Terminal aberto. Diga onde precisamos atacar.', 'Comandos prontos. Vamos abrir caminho.'],
    taskSuccess: ['Missão concluída!', 'Funcionou! Essa foi uma boa investida.'],
    taskFailure: ['Não acabou. Vamos tentar outra abordagem.', 'A investida falhou, mas ainda estamos de pé.']
  },
  suzaku: {
    save: ['Alterações registradas com segurança.', 'Progresso preservado. Podemos continuar.'],
    errors: ['Há erros que precisam ser tratados com cuidado.', 'Detectei uma inconsistência. Vamos corrigi-la corretamente.'],
    errorsCleared: ['Tudo corrigido. Bom trabalho.', 'O sistema está estável novamente.'],
    terminal: ['Terminal disponível. Verifique cada comando antes de executar.', 'Uma ferramenta poderosa exige responsabilidade.'],
    taskSuccess: ['Execução concluída sem incidentes.', 'Objetivo cumprido.'],
    taskFailure: ['A execução falhou. Precisamos entender a causa.', 'Vamos corrigir o processo antes de repetir.']
  }
};

function getContextReaction(character, type) {
  const choices = contextReactionSets[character]?.[type] || contextReactionSets.zero[type];
  return choices?.[Math.floor(Math.random() * choices.length)];
}

function getPomodoroMessage(character, state, phase, minutes) {
  const messages = {
    zero: {
      startFocus: `A operação começou. ${minutes} minutos de foco absoluto.`,
      startBreak: `Pausa tática de ${minutes} minutos. Recupere-se para o próximo movimento.`,
      completeFocus: 'Missão cumprida. A pausa estratégica está disponível.',
      completeBreak: 'Pausa encerrada. Retorne ao tabuleiro.',
      stop: 'Operação interrompida. Retomaremos quando estiver preparado.'
    },
    cc: {
      startFocus: `${minutes} minutos? Estarei observando.`,
      startBreak: `${minutes} minutos de pausa. Tempo suficiente para uma pizza?`,
      completeFocus: 'O foco acabou. Agora cumpra a parte do contrato que exige descanso.',
      completeBreak: 'A pausa terminou. Humanos realmente gostam de medir o tempo.',
      stop: 'Já desistiu do contrato? Podemos tentar novamente depois.'
    },
    kallen: {
      startFocus: `Missão iniciada! ${minutes} minutos sem recuar.`,
      startBreak: `Pausa de ${minutes} minutos. Até o Guren precisa resfriar.`,
      completeFocus: 'Conseguimos! Hora de recuperar as forças.',
      completeBreak: 'Recuperação concluída. Vamos voltar à linha de frente!',
      stop: 'Recuo temporário. A próxima investida será melhor.'
    },
    suzaku: {
      startFocus: `Período de foco iniciado: ${minutes} minutos.`,
      startBreak: `Intervalo de ${minutes} minutos. Descansar também faz parte da missão.`,
      completeFocus: 'Objetivo concluído. Faça uma pausa adequada.',
      completeBreak: 'Intervalo concluído. Podemos retomar com segurança.',
      stop: 'Sessão encerrada. Reorganize-se antes de continuar.'
    }
  };
  const key = state === 'stop'
    ? 'stop'
    : `${state}${phase === 'focus' ? 'Focus' : 'Break'}`;
  return messages[character]?.[key] || messages.zero[key];
}

function getAffinityLevelMessage(character, level) {
  const messages = {
    zero: `Nosso vínculo alcançou o nível ${level}. Você está se tornando indispensável ao plano.`,
    cc: `Vínculo nível ${level}. Parece que este contrato está ficando interessante.`,
    kallen: `Nível de vínculo ${level}! Posso contar ainda mais com você agora.`,
    suzaku: `Nosso vínculo chegou ao nível ${level}. Obrigado pela confiança.`
  };
  return messages[character] || messages.zero;
}

function getGeassTerminalOptions(context) {
  const isWindows = process.platform === 'win32';
  const script = vscode.Uri.joinPath(
    context.extensionUri,
    'terminal',
    isWindows ? 'geass-powershell.ps1' : 'geass-bash.sh'
  ).fsPath;

  return {
    name: 'Geass Requiem',
    shellPath: isWindows ? 'powershell.exe' : '/bin/bash',
    shellArgs: isWindows ? ['-NoExit', '-File', script] : ['--rcfile', script, '-i'],
    iconPath: new vscode.ThemeIcon('eye'),
    color: new vscode.ThemeColor('terminal.ansiMagenta')
  };
}

function activate(context) {
  const provider = new GeassCompanionProvider(context);
  void vscode.commands.executeCommand('setContext', 'geassRequiem.focusActive', Boolean(provider.focusEndsAt));
  const showCompanion = async () => {
    await vscode.commands.executeCommand('workbench.view.explorer');
    await vscode.commands.executeCommand(`${GeassCompanionProvider.viewType}.focus`);
  };
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(GeassCompanionProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.commands.registerCommand('geassRequiem.openCompanion', showCompanion),
    vscode.commands.registerCommand('geassRequiem.awakenGeass', async () => {
      await showCompanion();
      provider.awaken();
    }),
    vscode.commands.registerCommand('geassRequiem.startFocus', async () => {
      await showCompanion();
      await provider.startFocus();
    }),
    vscode.commands.registerCommand('geassRequiem.stopFocus', () => provider.stopFocus()),
    vscode.commands.registerCommand('geassRequiem.changeCharacter', async () => {
      const items = [
        { label: 'Zero', value: 'zero' },
        { label: 'C.C.', value: 'cc' },
        { label: 'Kallen', value: 'kallen' },
        { label: 'Suzaku', value: 'suzaku' }
      ];
      const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Escolha o personagem' });
      if (selected) await vscode.workspace.getConfiguration('geassRequiem').update(
        'character', selected.value, vscode.ConfigurationTarget.Global
      );
    }),
    vscode.commands.registerCommand('geassRequiem.changeScene', async () => {
      const items = [
        { label: 'Geass', value: 'geass' },
        { label: 'Tóquio à Noite', value: 'tokyo' },
        { label: 'Palácio de Britannia', value: 'britannia' },
        { label: 'Tabuleiro', value: 'chess' }
      ];
      const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Escolha o cenário' });
      if (selected) await vscode.workspace.getConfiguration('geassRequiem').update(
        'scene', selected.value, vscode.ConfigurationTarget.Global
      );
    }),
    vscode.window.registerTerminalProfileProvider('geassRequiem.terminalProfile', {
      provideTerminalProfile() {
        return new vscode.TerminalProfile(getGeassTerminalOptions(context));
      }
    }),
    vscode.commands.registerCommand('geassRequiem.openTerminal', () => {
      const terminal = vscode.window.createTerminal(getGeassTerminalOptions(context));
      terminal.show();
    }),
    vscode.workspace.onDidSaveTextDocument(() => provider.reactTo('save')),
    vscode.window.onDidOpenTerminal(() => provider.reactTo('terminal')),
    vscode.languages.onDidChangeDiagnostics((event) => {
      const activeUri = vscode.window.activeTextEditor?.document.uri;
      if (!activeUri) return;
      if (event.uris.some((uri) => uri.toString() === activeUri.toString())) {
        provider.handleDiagnostics(activeUri);
      }
    }),
    vscode.tasks.onDidEndTaskProcess((event) => {
      provider.reactTo(event.exitCode === 0 ? 'taskSuccess' : 'taskFailure');
    })
  );
}

function deactivate() {}

function getHtml(webview, frames, sceneBackdrop, character, scene, size, motion, focus, features) {
  const nonce = getNonce();
  const sizes = { small: 64, medium: 88, large: 118 };
  const spriteSize = sizes[size] || sizes.medium;
  const characterLabels = { zero: 'Zero', cc: 'C.C.', kallen: 'Kallen', suzaku: 'Suzaku' };
  const sceneLabels = { geass: 'Geass', tokyo: 'Tóquio à Noite', britannia: 'Britannia', chess: 'Tabuleiro' };
  const characterName = characterLabels[character] || characterLabels.zero;
  const characterTitles = {
    zero: 'Líder da Rebelião',
    cc: 'Portadora do Código',
    kallen: 'Ace dos Cavaleiros Negros',
    suzaku: 'Cavaleiro de Britannia'
  };
  const moodLabels = {
    zero: { calm: 'Observando', focused: 'Em estratégia', confident: 'No controle', concerned: 'Recalculando', celebrating: 'Vitória' },
    cc: { calm: 'Observando', focused: 'Curiosa', confident: 'Intrigada', concerned: 'Desconfiada', celebrating: 'Satisfeita' },
    kallen: { calm: 'Pronta', focused: 'Em combate', confident: 'Determinada', concerned: 'Em alerta', celebrating: 'Vibrando' },
    suzaku: { calm: 'Atento', focused: 'Em missão', confident: 'Resoluto', concerned: 'Preocupado', celebrating: 'Aliviado' }
  };
  const specialMessages = {
    zero: 'O Geass responde. Dê a ordem e mudaremos este mundo.',
    cc: 'Uma interação especial? Isso terá um preço: pizza.',
    kallen: 'Guren Mk-II, pronta para avançar!',
    suzaku: 'Lancelot, iniciando protocolo de combate.'
  };
  const rareEventData = {
    zero: { message: 'A máscara de Zero está no lugar. A operação secreta começou.', mood: 'focused' },
    cc: { message: 'Encontrei uma pizza. Considere este um acontecimento extremamente importante.', mood: 'celebrating' },
    kallen: { message: 'O Guren respondeu sozinho... parece que uma batalha se aproxima.', mood: 'confident' },
    suzaku: { message: 'Uma nova ordem chegou. Vou decidir como cumpri-la sem perder quem sou.', mood: 'concerned' }
  };
  const affinityDialogues = {
    zero: ['Você já compreende movimentos que eu não preciso explicar.', 'Nossa confiança é uma arma que Britannia não pode prever.', 'Quando o plano final começar, quero você ao meu lado.'],
    cc: ['Parece que você está aprendendo a conviver com uma imortal.', 'Poucas pessoas conseguem tornar a eternidade menos entediante.', 'Talvez este contrato signifique mais do que eu esperava.'],
    kallen: ['Com você cobrindo minha retaguarda, posso avançar sem hesitar.', 'Nós formamos uma boa equipe. Não conte isso ao Zero.', 'Se a batalha final chegar, sei que não estarei sozinha.'],
    suzaku: ['É mais fácil carregar uma missão quando alguém entende suas dúvidas.', 'Sua confiança me lembra por que ainda tento mudar as coisas.', 'Quero construir um futuro que nós dois possamos defender.']
  };

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <style nonce="${nonce}">
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    body {
      --sprite: ${spriteSize}px;
      color: var(--vscode-foreground);
      background: #09070d;
      font-family: var(--vscode-font-family);
    }
    .world { position: relative; width: 100%; height: 100%; min-height: 190px; }
    .scene-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; image-rendering: auto; pointer-events: none; }
    .scene-tokyo .scene-art { object-position: 52% center; }
    .scene-britannia .scene-art { object-position: center center; }
    .scene-chess .scene-art { object-position: 58% center; }
    .atmosphere { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, #07040b18 0%, transparent 42%, #07040b2b 68%, #07040b99 100%); box-shadow: inset 0 0 42px #0008; }
    .scene-geass .atmosphere { background: radial-gradient(circle at 50% 30%, transparent 0 18%, #12071344 54%, #040207bb 100%); }
    .scene-britannia .atmosphere { background: linear-gradient(180deg, #fff3c20a, transparent 58%, #28101d66 100%); }
    .scanlines { position: absolute; inset: 0; pointer-events: none; opacity: .09; background: repeating-linear-gradient(0deg, transparent 0 3px, #000 3px 4px); }
    .controls { position: absolute; z-index: 5; top: 6px; left: 6px; right: 6px; display: flex; gap: 5px; opacity: .78; transition: opacity .2s; }
    .controls:hover, .controls:focus-within { opacity: 1; }
    select { min-width: 0; flex: 1; height: 25px; color: #f7e9d0; background: #100c16e8; border: 1px solid #c3934f88; border-radius: 3px; font: 11px var(--vscode-font-family); box-shadow: 0 2px 10px #0008; }
    .focus-button { flex: 0 0 auto; min-width: 30px; height: 25px; padding: 0 7px; color: #f7e9d0; background: #100c16e8; border: 1px solid #c3934f88; border-radius: 3px; font: 700 10px var(--vscode-font-family); cursor: pointer; box-shadow: 0 2px 10px #0008; }
    .focus-button:hover { color: #fff; border-color: #e7bc5d; background: #25172de8; }
    .focus-button.active { min-width: 52px; color: #fff5e4; border-color: #bf335c; background: #58172be8; font-variant-numeric: tabular-nums; }
    .nameplate { position: absolute; z-index: 4; left: 8px; bottom: 7px; max-width: calc(100% - 16px); padding: 4px 8px 5px; color: #f6ddb0; background: linear-gradient(90deg, #100914e8, #10091488); border-left: 2px solid #bf335c; font: 10px var(--vscode-font-family); letter-spacing: .08em; text-transform: uppercase; text-shadow: 0 1px #000; }
    .nameplate strong { display: block; color: #fff5e4; font-size: 12px; letter-spacing: .04em; }
    .affinity { margin-left: 6px; color: #e7bc5d; font-size: 9px; }
    .mood { margin-left: 6px; color: #c9a8f2; font-size: 9px; }
    .sprite-wrap {
      position: absolute; left: 0; bottom: 24px; width: var(--sprite); height: var(--sprite);
      cursor: pointer; z-index: 3; transform-origin: center bottom; transform: translateX(18px);
      transition-property: transform; transition-timing-function: linear; will-change: transform;
    }
    .advanced .sprite-wrap { cursor: grab; touch-action: none; }
    .advanced .sprite-wrap.dragging { cursor: grabbing; }
    .sprite { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; filter: drop-shadow(0 10px 7px #0008); user-select: none; -webkit-user-drag: none; transition: transform .18s ease; }
    .motion .idle .sprite { animation: breathe 2.2s ease-in-out infinite; }
    .motion .talking .sprite { animation: talk-bob .64s ease-in-out infinite; }
    .bubble {
      position: absolute; left: 50%; bottom: calc(100% - 6px); width: max-content; min-width: 150px; max-width: min(230px, 82vw);
      transform: translateX(-50%); padding: 9px 12px; border: 1px solid #d7a84baa; border-radius: 3px;
      color: #fff8ec; background: linear-gradient(145deg, #17101ef2, #09070df2);
      font-size: 12px; line-height: 1.35; text-align: left; opacity: 0; transition: opacity .18s, translate .18s; translate: 0 4px; pointer-events: none;
      box-shadow: 0 7px 22px #000b, inset 0 0 16px #8e27431c;
    }
    .bubble::after { content: ''; position: absolute; left: 50%; top: 100%; border: 6px solid transparent; border-top-color: #d7a84baa; transform: translateX(-50%); }
    .bubble.visible { opacity: 1; translate: 0 0; }
    .speaker { display: block; margin-bottom: 3px; color: #e7bc5d; font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    .awaken .atmosphere { animation: pulse .9s ease-out; }
    .awaken .sprite { animation: awaken .9s ease-out; }
    .mood-concerned .nameplate { border-left-color: #ff7581; }
    .mood-concerned .sprite { filter: saturate(.75) drop-shadow(0 10px 7px #0008); }
    .mood-confident .nameplate, .mood-focused .nameplate { border-left-color: #e7bc5d; }
    .mood-celebrating .nameplate { border-left-color: #72c5a0; }
    .mood-celebrating .sprite { filter: brightness(1.16) drop-shadow(0 0 9px #e7bc5d88); }
    .event-flash { position: absolute; z-index: 2; inset: 0; pointer-events: none; opacity: 0; background: radial-gradient(circle at 50% 55%, #e7bc5d44, #f05a8222 36%, transparent 70%); }
    .rare-event .event-flash { animation: rare-flash 2.8s ease-out; }
    .interaction-menu { position: absolute; z-index: 8; left: 50%; bottom: 37px; display: none; gap: 4px; transform: translateX(-50%); padding: 5px; background: #100c16f2; border: 1px solid #c3934f99; border-radius: 4px; box-shadow: 0 8px 22px #000c; }
    .interaction-menu.visible { display: flex; }
    .interaction-menu button { padding: 4px 7px; color: #f7e9d0; background: #25172d; border: 1px solid #59406a; border-radius: 3px; font: 10px var(--vscode-font-family); cursor: pointer; }
    .interaction-menu button:hover { border-color: #e7bc5d; color: #fff; }
    @keyframes breathe { 50% { scale: 1.025 .985; translate: 0 1px; } }
    @keyframes talk-bob { 50% { translate: 0 -2px; rotate: -1deg; } }
    @keyframes pulse { 45% { background-color: #f05a8244; box-shadow: inset 0 0 90px #f05a8277; } }
    @keyframes awaken { 35% { scale: 1.25; filter: brightness(1.8) drop-shadow(0 0 22px #f05a82); } }
    @keyframes rare-flash { 0%, 100% { opacity: 0; } 24% { opacity: 1; } 55% { opacity: .35; } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } .sprite-wrap { transform: translateX(24px); } }
  </style>
</head>
<body class="scene-${scene}${motion ? ' motion' : ''}${features.advancedInteractions ? ' advanced' : ''}">
  <main class="world" aria-label="Geass Companion">
    <img class="scene-art" src="${sceneBackdrop}" alt="Cenário ${sceneLabels[scene]}">
    <div class="atmosphere"></div>
    <div class="scanlines"></div>
    <div class="event-flash"></div>
    <div class="controls">
      <select id="character" aria-label="Personagem">
        ${Object.entries(characterLabels).map(([value, label]) => `<option value="${value}"${character === value ? ' selected' : ''}>${label}</option>`).join('')}
      </select>
      <select id="scene" aria-label="Cenário">
        ${Object.entries(sceneLabels).map(([value, label]) => `<option value="${value}"${scene === value ? ' selected' : ''}>${label}</option>`).join('')}
      </select>
      ${focus.enabled ? `<button id="focus" class="focus-button" type="button" title="Controlar Pomodoro" aria-label="Controlar Pomodoro">◎</button>` : ''}
    </div>
    <div class="nameplate"><strong>${characterName}${features.affinity ? `<span id="affinity" class="affinity">VÍNCULO ${features.affinityState.level}</span>` : ''}</strong><span>${characterTitles[character]}</span>${features.emotions ? `<span id="mood" class="mood">${moodLabels[character].calm}</span>` : ''}</div>
    <div id="companion" class="sprite-wrap idle" role="button" tabindex="0" aria-label="Interagir com ${characterName}">
      <div id="bubble" class="bubble"><span class="speaker">${characterName}</span><span id="dialogue">Clique para interagir.</span></div>
      <img id="sprite" class="sprite" src="${frames.idle[0]}" alt="${characterName} em pixel art">
    </div>
    ${features.advancedInteractions ? `<div id="interaction-menu" class="interaction-menu" role="menu"><button type="button" data-action="talk">Falar</button><button type="button" data-action="special">Especial</button>${focus.enabled ? `<button type="button" data-action="focus">Foco</button>` : ''}</div>` : ''}
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const companion = document.getElementById('companion');
    const sprite = document.getElementById('sprite');
    const bubble = document.getElementById('bubble');
    const dialogue = document.getElementById('dialogue');
    const focusButton = document.getElementById('focus');
    const affinityLabel = document.getElementById('affinity');
    const moodLabel = document.getElementById('mood');
    const interactionMenu = document.getElementById('interaction-menu');
    const motionEnabled = ${motion};
    const focusEnabled = ${focus.enabled};
    const affinityEnabled = ${features.affinity};
    const emotionsEnabled = ${features.emotions};
    const advancedInteractions = ${features.advancedInteractions};
    const rareEventsEnabled = ${features.rareEvents};
    const rareEventFrequency = ${JSON.stringify(features.rareEventFrequency)};
    const focusDuration = ${focus.duration};
    let focusEndsAt = ${focus.endsAt || 'null'};
    let focusPhase = ${JSON.stringify(focus.phase)};
    let completedFocuses = ${focus.completedFocuses};
    let pomodoroSettings = ${JSON.stringify(focus.settings)};
    let affinityState = ${JSON.stringify(features.affinityState)};
    let focusTicker;
    const frames = ${JSON.stringify(frames)};
    const moodLabels = ${JSON.stringify(moodLabels[character])};
    const specialMessage = ${JSON.stringify(specialMessages[character])};
    const rareEvent = ${JSON.stringify(rareEventData[character])};
    const affinityMessages = ${JSON.stringify(affinityDialogues[character])};
    const dialogueSets = ${JSON.stringify({
      zero: {
        default: ['Uma vitória sem objetivo é apenas ruído.', 'Observe primeiro. Até o silêncio revela uma fraqueza.', 'Se o mundo não mudar sozinho, nós mudaremos as regras.', 'Cada comando é uma peça. Não desperdice nenhuma.', 'O plano funciona quando todos enxergam apenas o que você permite.'],
        geass: ['Poder sem determinação não passa de uma maldição.', 'O Geass abre o caminho; a escolha de atravessá-lo ainda é sua.', 'Não desvie os olhos. Este é o momento da decisão.'],
        tokyo: ['Tóquio ainda respira sob as luzes do império.', 'Uma cidade inteira pode se tornar o nosso tabuleiro.'],
        britannia: ['Tronos parecem eternos até o instante em que caem.', 'Toda autoridade possui um ponto cego.'],
        chess: ['Não mova a peça mais forte. Mova a peça que muda o jogo.', 'Xeque-mate começa muito antes do último movimento.']
      },
      cc: {
        default: ['Contratos não concedem milagres; apenas possibilidades.', 'Humanos sempre pedem poder antes de pensar no preço.', 'Não confunda eternidade com paciência.', 'Você está trabalhando demais. Isso pede pizza.', 'Continue. Quero ver até onde essa escolha vai levar você.'],
        geass: ['Este lugar se lembra de todos que desejaram poder.', 'O símbolo reage à vontade, não à coragem.'],
        tokyo: ['As luzes mudaram, mas a solidão da cidade continua igual.', 'Daqui de cima, impérios e rebeliões parecem pequenos.'],
        britannia: ['Luxo é apenas outra maneira de esconder o vazio.', 'Já vi salões como este desaparecerem da história.'],
        chess: ['Você trata pessoas como peças. Ao menos cuide das suas.', 'Vou observar. Jogos humanos costumam ser divertidos.']
      },
      kallen: {
        default: ['Se existe uma abertura, eu consigo atravessar.', 'Planejar é importante. Agir na hora certa é ainda mais.', 'Não estamos lutando por uma bandeira. Estamos lutando pelas pessoas.', 'Pode deixar a linha de frente comigo.', 'Hesitar agora só torna a próxima batalha mais difícil.'],
        geass: ['Esse poder é assustador... mas ficar parada seria pior.', 'Só prometa que não vai perder quem você é.'],
        tokyo: ['Esta é a nossa cidade. Não vou deixá-la para trás.', 'Conheço um caminho entre aqueles prédios. Vamos.'],
        britannia: ['Bonito por fora. Construído sobre gente que nunca entrou aqui.', 'Um salão enorme não torna um governante maior.'],
        chess: ['Chega de olhar o tabuleiro. Onde eu preciso atacar?', 'Eu prefiro uma rota direta, mas sigo o seu plano.']
      },
      suzaku: {
        default: ['Mudar o sistema por dentro é lento, mas ainda é uma escolha.', 'Uma ordem não elimina a responsabilidade de quem a cumpre.', 'Se há uma chance de evitar perdas, precisamos encontrá-la.', 'Força sem princípios apenas repete o mesmo erro.', 'Eu termino a missão, mas não ignoro o custo.'],
        geass: ['Um poder que remove escolhas também cobra algo de quem o usa.', 'Eu conheço bem demais a força de uma ordem impossível de recusar.'],
        tokyo: ['Cada luz lá embaixo pertence a alguém que quer viver em paz.', 'Proteger a cidade significa encarar os dois lados do conflito.'],
        britannia: ['Este uniforme abre portas, mas também carrega expectativas.', 'Justiça e lealdade nem sempre apontam para a mesma direção.'],
        chess: ['Pessoas não deveriam ser sacrificadas como peões.', 'Se vencer exige abandonar todos, talvez o jogo esteja errado.']
      }
    })};
    const characterDialogues = dialogueSets[${JSON.stringify(character)}];
    const messages = [...characterDialogues.default, ...(characterDialogues[${JSON.stringify(scene)}] || [])];
    if (affinityEnabled) messages.push(...affinityMessages.slice(0, Math.max(0, affinityState.level - 1)));
    let lastMessage = -1;
    let hideTimer, behaviorTimer, movementTimer, animationTimer, moodTimer, rareEventTimer, clickTimer;
    let currentX = 18;
    let isTalking = false;
    let dragged = false;
    let dragStartX = 0;
    let dragOriginX = 18;

    Object.values(frames).flat().forEach((source) => {
      const image = new Image();
      image.src = source;
    });

    document.getElementById('character').addEventListener('change', (event) => {
      vscode.postMessage({ type: 'changeCharacter', value: event.target.value });
    });
    document.getElementById('scene').addEventListener('change', (event) => {
      vscode.postMessage({ type: 'changeScene', value: event.target.value });
    });
    focusButton?.addEventListener('click', () => {
      vscode.postMessage({ type: focusEndsAt ? 'stopFocus' : 'startFocus', phase: focusPhase });
    });

    function updateFocusButton() {
      if (!focusEnabled || !focusButton) return;
      clearInterval(focusTicker);
      if (!focusEndsAt) {
        const isBreak = focusPhase !== 'focus';
        const phaseDuration = pomodoroSettings[focusPhase] || focusDuration;
        focusButton.textContent = isBreak ? '☕' : '◎';
        focusButton.classList.remove('active');
        focusButton.title = isBreak
          ? 'Iniciar ' + (focusPhase === 'longBreak' ? 'pausa longa' : 'pausa curta') + ' de ' + phaseDuration + ' minutos'
          : 'Iniciar foco de ' + phaseDuration + ' minutos — ciclo ' + (completedFocuses + 1) + '/' + pomodoroSettings.sessionsBeforeLongBreak;
        focusButton.setAttribute('aria-label', focusButton.title);
        return;
      }
      const renderRemaining = () => {
        const remaining = Math.max(0, focusEndsAt - Date.now());
        const totalSeconds = Math.ceil(remaining / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        const prefix = focusPhase === 'focus' ? 'F ' : focusPhase === 'longBreak' ? 'PL ' : 'PC ';
        focusButton.textContent = prefix + minutes + ':' + seconds;
        focusButton.classList.add('active');
        focusButton.title = focusPhase === 'focus' ? 'Parar foco' : 'Parar pausa';
        focusButton.setAttribute('aria-label', focusButton.title + '. Restam ' + minutes + ' minutos e ' + seconds + ' segundos.');
      };
      renderRemaining();
      focusTicker = setInterval(renderRemaining, 1000);
    }

    function setMood(mood = 'calm', duration = 8000) {
      if (!emotionsEnabled) return;
      document.body.classList.remove('mood-calm', 'mood-focused', 'mood-confident', 'mood-concerned', 'mood-celebrating');
      document.body.classList.add('mood-' + mood);
      if (moodLabel) moodLabel.textContent = moodLabels[mood] || moodLabels.calm;
      clearTimeout(moodTimer);
      if (mood !== 'calm' && duration > 0) moodTimer = setTimeout(() => setMood('calm', 0), duration);
    }

    function updateAffinity(nextAffinity) {
      if (!affinityEnabled || !affinityLabel || !nextAffinity) return;
      const previousLevel = affinityState.level;
      affinityState = nextAffinity;
      if (affinityState.level > previousLevel) {
        const unlocked = affinityMessages.slice(
          Math.max(0, previousLevel - 1),
          Math.max(0, affinityState.level - 1)
        );
        unlocked.forEach((message) => {
          if (!messages.includes(message)) messages.push(message);
        });
      }
      affinityLabel.textContent = 'VÍNCULO ' + affinityState.level;
      affinityLabel.title = affinityState.nextThreshold
        ? affinityState.points + ' / ' + affinityState.nextThreshold + ' pontos'
        : affinityState.points + ' pontos — vínculo máximo';
    }

    function triggerSpecialInteraction() {
      document.body.classList.remove('awaken');
      requestAnimationFrame(() => document.body.classList.add('awaken'));
      setMood('confident');
      interact(specialMessage);
      vscode.postMessage({ type: 'companionInteraction' });
      setTimeout(() => document.body.classList.remove('awaken'), 1000);
    }

    function hideInteractionMenu() {
      interactionMenu?.classList.remove('visible');
    }

    function scheduleRareEvent() {
      clearTimeout(rareEventTimer);
      if (!rareEventsEnabled) return;
      const ranges = {
        rare: [15, 30],
        normal: [8, 18],
        frequent: [3, 8]
      };
      const [minimum, maximum] = ranges[rareEventFrequency] || ranges.rare;
      const delay = (minimum + Math.random() * (maximum - minimum)) * 60 * 1000;
      rareEventTimer = setTimeout(() => {
        document.body.classList.remove('rare-event');
        requestAnimationFrame(() => document.body.classList.add('rare-event'));
        setMood(rareEvent.mood, 12000);
        interact(rareEvent.message);
        vscode.postMessage({ type: 'rareEvent' });
        setTimeout(() => document.body.classList.remove('rare-event'), 3000);
        scheduleRareEvent();
      }, delay);
    }

    function setAnimation(state, interval) {
      clearInterval(animationTimer);
      companion.classList.remove('walking', 'idle', 'talking');
      companion.classList.add(state === 'talk' ? 'talking' : state);
      let frame = 0;
      sprite.src = frames[state][frame];
      if (!motionEnabled || frames[state].length < 2) return;
      animationTimer = setInterval(() => {
        frame = (frame + 1) % frames[state].length;
        sprite.src = frames[state][frame];
      }, interval);
    }

    function freezeMovement() {
      clearTimeout(movementTimer);
      const transform = getComputedStyle(companion).transform;
      if (transform && transform !== 'none') {
        try { currentX = new DOMMatrixReadOnly(transform).m41; } catch (_) {}
      }
      companion.style.transitionDuration = '0ms';
      companion.style.transform = 'translateX(' + currentX + 'px)';
    }

    function interact(customMessage) {
      isTalking = true;
      clearTimeout(behaviorTimer);
      freezeMovement();
      setAnimation('talk', 310);
      let nextMessage = Math.floor(Math.random() * messages.length);
      if (messages.length > 1 && nextMessage === lastMessage) nextMessage = (nextMessage + 1) % messages.length;
      lastMessage = nextMessage;
      const message = typeof customMessage === 'string' ? customMessage : messages[nextMessage];
      dialogue.textContent = message;
      bubble.classList.add('visible');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        isTalking = false;
        bubble.classList.remove('visible');
        setAnimation('idle', 900);
        scheduleBehavior(700);
      }, 2400);
    }

    function scheduleBehavior(delay = 600) {
      if (!motionEnabled) return;
      clearTimeout(behaviorTimer);
      behaviorTimer = setTimeout(() => {
        if (Math.random() < .38) {
          setAnimation('idle', 900);
          scheduleBehavior(1200 + Math.random() * 2200);
          return;
        }
        const maxX = Math.max(18, window.innerWidth - companion.offsetWidth - 18);
        const destination = 18 + Math.random() * Math.max(1, maxX - 18);
        const distance = Math.abs(destination - currentX);
        const duration = Math.max(900, Math.min(4300, distance / .035));
        sprite.style.transform = 'scaleX(' + (destination < currentX ? -1 : 1) + ')';
        companion.style.transitionDuration = duration + 'ms';
        setAnimation('walk', 145);
        requestAnimationFrame(() => { companion.style.transform = 'translateX(' + destination + 'px)'; });
        currentX = destination;
        clearTimeout(movementTimer);
        movementTimer = setTimeout(() => {
          setAnimation('idle', 900);
          scheduleBehavior(700 + Math.random() * 1700);
        }, duration);
      }, delay);
    }

    companion.addEventListener('click', () => {
      if (dragged) {
        dragged = false;
        return;
      }
      const talk = () => {
        interact();
        vscode.postMessage({ type: 'companionInteraction' });
      };
      if (!advancedInteractions) {
        talk();
        return;
      }
      clearTimeout(clickTimer);
      clickTimer = setTimeout(talk, 280);
    });
    companion.addEventListener('dblclick', (event) => {
      if (!advancedInteractions) return;
      event.preventDefault();
      clearTimeout(clickTimer);
      triggerSpecialInteraction();
    });
    companion.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        interact();
        vscode.postMessage({ type: 'companionInteraction' });
      }
    });
    companion.addEventListener('mouseenter', () => {
      clearTimeout(behaviorTimer);
      freezeMovement();
      if (!isTalking) setAnimation('idle', 900);
    });
    companion.addEventListener('mouseleave', () => {
      if (!isTalking) scheduleBehavior(500);
    });
    companion.addEventListener('contextmenu', (event) => {
      if (!advancedInteractions || !interactionMenu) return;
      event.preventDefault();
      interactionMenu.classList.toggle('visible');
    });
    companion.addEventListener('pointerdown', (event) => {
      if (!advancedInteractions || event.button !== 0) return;
      freezeMovement();
      dragged = false;
      dragStartX = event.clientX;
      dragOriginX = currentX;
      companion.classList.add('dragging');
      companion.setPointerCapture(event.pointerId);
    });
    companion.addEventListener('pointermove', (event) => {
      if (!advancedInteractions || !companion.hasPointerCapture(event.pointerId)) return;
      const delta = event.clientX - dragStartX;
      if (Math.abs(delta) > 4) dragged = true;
      const maxX = Math.max(18, window.innerWidth - companion.offsetWidth - 18);
      currentX = Math.max(18, Math.min(maxX, dragOriginX + delta));
      companion.style.transitionDuration = '0ms';
      companion.style.transform = 'translateX(' + currentX + 'px)';
    });
    companion.addEventListener('pointerup', (event) => {
      if (!advancedInteractions || !companion.hasPointerCapture(event.pointerId)) return;
      companion.releasePointerCapture(event.pointerId);
      companion.classList.remove('dragging');
      if (!isTalking) scheduleBehavior(900);
    });
    interactionMenu?.addEventListener('click', (event) => {
      const action = event.target.closest('button')?.dataset.action;
      if (action === 'talk') {
        interact();
        vscode.postMessage({ type: 'companionInteraction' });
      }
      if (action === 'special') triggerSpecialInteraction();
      if (action === 'focus') vscode.postMessage({ type: focusEndsAt ? 'stopFocus' : 'startFocus', phase: focusPhase });
      hideInteractionMenu();
    });
    document.addEventListener('click', (event) => {
      if (!interactionMenu?.contains(event.target) && !companion.contains(event.target)) hideInteractionMenu();
    });
    window.addEventListener('resize', () => {
      const maxX = Math.max(18, window.innerWidth - companion.offsetWidth - 18);
      currentX = Math.min(currentX, maxX);
      companion.style.transitionDuration = '0ms';
      companion.style.transform = 'translateX(' + currentX + 'px)';
    });
    window.addEventListener('message', (event) => {
      if (event.data.type === 'reaction') {
        if (event.data.mood) setMood(event.data.mood);
        interact(event.data.message);
        return;
      }
      if (event.data.type === 'affinityState') {
        updateAffinity(event.data.affinity);
        return;
      }
      if (event.data.type === 'focusState') {
        focusEndsAt = event.data.endsAt;
        focusPhase = event.data.phase || 'focus';
        completedFocuses = event.data.completedFocuses || 0;
        pomodoroSettings = event.data.settings || pomodoroSettings;
        updateFocusButton();
        return;
      }
      if (event.data.type === 'awaken') {
        document.body.classList.remove('awaken');
        requestAnimationFrame(() => document.body.classList.add('awaken'));
        setMood('confident');
        interact(${JSON.stringify(character === 'zero'
          ? 'O Geass desperta. Agora transforme intenção em ação.'
          : character === 'cc'
            ? 'O contrato respondeu. Espero que esteja preparado.'
            : character === 'kallen'
              ? 'Esse poder... use-o para abrir o nosso caminho.'
              : 'O Geass despertou. Não deixe que ele escolha por você.')});
        setTimeout(() => document.body.classList.remove('awaken'), 1000);
      }
    });
    updateAffinity(affinityState);
    setMood('calm', 0);
    updateFocusButton();
    setAnimation('idle', 900);
    scheduleBehavior();
    scheduleRareEvent();
  </script>
</body>
</html>`;
}

function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let i = 0; i < 32; i += 1) value += chars[Math.floor(Math.random() * chars.length)];
  return value;
}

module.exports = { activate, deactivate };
