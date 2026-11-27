/* IDCGT-AP — interface do participante.
 *
 * Princípios de privacidade aplicados neste arquivo:
 *  - todo o estado fica somente em memória (sem cookies, localStorage,
 *    sessionStorage, IndexedDB ou identificador de qualquer tipo);
 *  - nenhuma requisição de rede é feita antes da confirmação final de envio;
 *  - o envio contém exclusivamente "concluido" e Q01–Q39 (e, no pré-teste,
 *    os campos do roteiro escrito);
 *  - o feedback é calculado após o envio confirmado e nunca é transmitido.
 */
(function () {
  'use strict';

  var CFG = window.IDCGT_CONFIG;
  var INST = window.IDCGT_INSTRUMENTO;
  var PRE = CFG.modo === 'pre_teste';
  var PLACEHOLDER_PARECER = '[INSERIR NÚMERO E DATA ANTES DA PUBLICAÇÃO]';
  var TEMPO_LIMITE_ENVIO = 60000;

  var CONTATO = 'Dúvidas: João Pedro de Lima Oliveira; jploliveira19@gmail.com e joaopedro@rbcip.org; (86) 99946-8030.';

  var TEXTOS = {
    inicioTitulo: PRE ? 'Pré-teste semântico e funcional do IDCGT AP'
                      : 'Pesquisa sobre competências e práticas organizacionais na RBCIP',
    inicio: PRE
      ? ['Você está sendo convidado a participar do pré-teste do questionário IDCGT AP, que verificará a clareza das instruções, dos itens, das escalas, do consentimento e do funcionamento da página.',
         'A atividade durará aproximadamente 20 a 30 minutos. Não haverá entrevista, gravação de voz, captura de imagem ou vídeo. Seus registros não serão incorporados ao diagnóstico da RBCIP.']
      : ['Você está sendo convidado a participar de uma pesquisa vinculada ao Mestrado Profissional em Administração Pública da Universidade de Brasília. O questionário leva cerca de 15 a 20 minutos. A participação é voluntária, as perguntas podem ser deixadas sem resposta e a RBCIP receberá somente resultados agregados.'],
    consentimento: 'Leia o termo completo antes de decidir. Você pode baixar uma cópia em PDF. O questionário somente será aberto se você selecionar Concordo em participar.',
    concordo: PRE ? 'Li as informações, tive acesso à cópia em PDF e concordo voluntariamente em participar do pré-teste.'
                  : 'Li as informações, tive acesso à cópia em PDF e concordo voluntariamente em participar.',
    naoConcordo: PRE ? 'Não concordo em participar. A atividade será encerrada.'
                     : 'Não concordo em participar. O questionário será encerrado.',
    recusa: 'Sua decisão foi registrada apenas nesta tela e nenhuma resposta foi transmitida. Você pode fechar a página.',
    instrucoes: 'Responda com base em sua atuação habitual e no que observa na RBCIP. Não há respostas certas ou erradas. Você poderá deixar perguntas sem resposta e interromper antes do envio. Nas questões abertas, não mencione nomes, projetos sigilosos ou fatos que permitam identificar terceiros.',
    escalaFreq: 'Competências transversais e gerenciais: 1 Nunca; 2 Raramente; 3 Às vezes; 4 Frequentemente; 5 Sempre.',
    escalaPrat: 'Práticas organizacionais: 1 Não observada; 2 Pouco observada; 3 Parcialmente observada; 4 Amplamente observada; 5 Plenamente implementada; além de Não sei ou não se aplica.',
    revisao: 'Revise suas respostas antes do envio. Depois de selecionar Enviar, não será possível localizar e excluir uma resposta específica, pois o banco não conterá identificador individual.',
    erro: 'Não foi possível confirmar o envio. Suas respostas não devem ser consideradas recebidas até que a mensagem de conclusão seja exibida. Tente novamente ou entre em contato com o pesquisador sem enviar respostas por e-mail.',
    conclusao: PRE
      ? ['Suas respostas foram enviadas. Obrigado por participar do pré-teste.']
      : ['Suas respostas foram enviadas. Obrigado por participar. A RBCIP receberá somente resultados agregados. Após a conclusão da pesquisa, o setor de Recursos Humanos encaminhará uma síntese pelo mesmo canal utilizado no convite.'],
    cancelado: 'Participação cancelada. Nenhuma resposta foi transmitida e as respostas preenchidas nesta tela foram apagadas. Você pode fechar a página.',
    naoLiberado: 'A coleta ainda não foi liberada. Esta página somente será aberta após a decisão ética favorável e a conclusão dos controles de conformidade técnica.',
    roteiroIntro: 'Responda por escrito às perguntas abaixo sobre sua experiência. O pesquisador não realizará entrevista e não gravará a sessão. Todas as perguntas são facultativas.'
  };

  // ---------------------------------------------------------------- estado
  var estado;
  function novoEstado(anterior) {
    return {
      consentiu: false,
      respostas: {},
      extras: {},
      enviando: false,
      enviado: false,
      feedback: null,
      feedbackVisivel: false,
      confirmarCancelamento: false,
      codigoEnvio: null,   // código temporário de envio (somente memória)
      corpoTentado: null,
      fim: anterior ? anterior.fim : null // 'recusa' | 'cancelado' | 'concluido'
    };
  }
  estado = novoEstado();

  // --------------------------------------------------------------- utilidades
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'texto') el.textContent = v;
      else if (k === 'classe') el.className = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) el.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
      else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function anunciar(msg) {
    var a = document.getElementById('anuncio');
    a.textContent = '';
    setTimeout(function () { a.textContent = msg; }, 50);
  }
  function parecerValido() {
    return typeof CFG.parecer === 'string' && CFG.parecer.trim() !== '' && CFG.parecer.indexOf('INSERIR') === -1;
  }
  function ambienteDeTeste() { return CFG.ambiente === 'desenvolvimento'; }
  function liberado() {
    if (ambienteDeTeste()) return true;
    var esperado = PRE ? 'pre_teste' : 'producao';
    return CFG.ambiente === esperado && parecerValido() && /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(CFG.endpoint || '');
  }
  // Navegação interna síncrona; o histórico do navegador (voltar/avançar) é
  // tratado pelos eventos popstate/hashchange.
  var ultimaRota = null;
  function ir(rota) {
    if (location.hash !== rota) history.pushState(null, '', rota);
    render();
  }
  function aoNavegar() {
    if (location.hash !== ultimaRota) render();
  }
  function itensDoBloco(bloco) {
    return INST.itens.filter(function (i) { return i.bloco === bloco; });
  }
  function temResposta() {
    return Object.keys(estado.respostas).some(function (k) { return estado.respostas[k] !== null && estado.respostas[k] !== undefined && estado.respostas[k] !== ''; }) ||
      Object.keys(estado.extras).some(function (k) { return estado.extras[k]; });
  }

  // ------------------------------------------------------------- etapas
  var BLOCOS = ['Perfil', 'Competências transversais', 'Práticas organizacionais', 'Competências gerenciais', 'Questões abertas'];
  function etapas() {
    var lista = BLOCOS.filter(function (b) {
      return b !== 'Competências gerenciais' || estado.respostas.Q08 === 1;
    }).map(function (b) { return { bloco: b, titulo: b }; });
    if (PRE) lista.push({ bloco: '__roteiro', titulo: 'Observações sobre o pré-teste' });
    return lista;
  }

  // --------------------------------------------------------------- telas
  var app = document.getElementById('app');

  function tela(titulo, conteudo) {
    app.textContent = '';
    var h1 = h('h1', { tabindex: '-1', id: 'titulo-tela', texto: titulo });
    app.appendChild(h1);
    conteudo.forEach(function (c) { if (c) app.appendChild(c); });
    window.scrollTo(0, 0);
    h1.focus();
  }

  function telaInicio() {
    if (estado.fim) {
      var msg = estado.fim === 'concluido' ? 'Suas respostas já foram enviadas nesta sessão. Você pode fechar a página.'
        : estado.fim === 'recusa' ? TEXTOS.recusa : TEXTOS.cancelado;
      return tela('Atividade encerrada', [h('p', { texto: msg })]);
    }
    var paragrafos = TEXTOS.inicio.map(function (t) { return h('p', { texto: t }); });
    if (!liberado()) {
      return tela(TEXTOS.inicioTitulo, paragrafos.concat([h('p', { classe: 'alerta', role: 'status', texto: TEXTOS.naoLiberado })]));
    }
    tela(TEXTOS.inicioTitulo, paragrafos.concat([
      h('div', { classe: 'acoes' },
        h('a', { classe: 'botao primario', href: '#/consentimento', texto: 'Ler o TCLE', onclick: function (e) { e.preventDefault(); ir('#/consentimento'); } }),
        h('a', { classe: 'botao', href: CFG.documentos.privacidade, target: '_blank', rel: 'noopener', texto: 'Consultar o aviso de privacidade' }),
        PRE ? h('a', { classe: 'botao', href: CFG.documentos.roteiro, target: '_blank', rel: 'noopener', texto: 'Roteiro do pré-teste (PDF)' }) : null)
    ]));
  }

  function telaConsentimento() {
    var termo = document.getElementById('tcle').content.cloneNode(true);
    Array.prototype.forEach.call(termo.querySelectorAll('[data-parecer]'), function (el) {
      el.textContent = parecerValido() ? CFG.parecer : PLACEHOLDER_PARECER;
    });
    var descConcordo = h('p', { id: 'desc-concordo', classe: 'descricao', texto: TEXTOS.concordo });
    var descNao = h('p', { id: 'desc-nao', classe: 'descricao', texto: TEXTOS.naoConcordo });
    tela('Consentimento', [
      h('p', { texto: TEXTOS.consentimento }),
      h('p', null, h('a', { classe: 'botao', href: CFG.documentos.tcle, download: '', target: '_blank', rel: 'noopener', texto: 'Baixar TCLE em PDF' })),
      h('article', { classe: 'termo', 'aria-label': 'Termo de Consentimento Livre e Esclarecido' }, termo),
      h('section', { classe: 'decisao', 'aria-labelledby': 'tit-decisao' },
        h('h2', { id: 'tit-decisao', texto: 'Registro eletrônico do consentimento' }),
        h('div', { classe: 'opcao-decisao' },
          h('button', { type: 'button', classe: 'botao primario', id: 'btn-concordo', 'aria-describedby': 'desc-concordo', texto: 'Concordo em participar', onclick: function () {
            estado.consentiu = true;
            ir('#/questionario/1');
          } }), descConcordo),
        h('div', { classe: 'opcao-decisao' },
          h('button', { type: 'button', classe: 'botao', id: 'btn-nao-concordo', 'aria-describedby': 'desc-nao', texto: 'Não concordo', onclick: function () {
            estado = novoEstado();
            estado.fim = 'recusa';
            ir('#/recusa');
          } }), descNao))
    ]);
  }

  function telaFim(titulo, texto) {
    tela(titulo, [h('p', { texto: texto })]);
  }

  // ------------------------------------------------------- questionário
  function rotuloEscala(item, opcao) {
    return item.tipo === 'ordinal' ? opcao.valor + ' — ' + opcao.rotulo : opcao.rotulo;
  }

  function campoItem(item) {
    var nome = item.codigo;
    var fs = h('fieldset', { classe: 'item ' + (item.tipo === 'ordinal' ? 'escala' : 'categorias'), id: 'item-' + nome });
    var leg = h('legend', null, h('span', { classe: 'codigo', texto: nome }), ' ', item.texto);
    fs.appendChild(leg);
    var grupo = h('div', { classe: 'opcoes' + (item.opcoes.length > 6 ? ' muitas' : '') });
    item.opcoes.forEach(function (op, idx) {
      var id = nome + '-' + idx;
      var input = h('input', { type: 'radio', name: nome, id: id, value: String(idx) });
      if (estado.respostas[nome] === op.valor) input.checked = true;
      input.addEventListener('change', function () { definirResposta(item, op.valor); });
      grupo.appendChild(h('label', { classe: 'opcao' + (op.valor === 9 && item.tipo === 'ordinal' ? ' nsa' : ''), for: id }, input, h('span', { texto: rotuloEscala(item, op) })));
    });
    fs.appendChild(grupo);
    fs.appendChild(h('button', { type: 'button', classe: 'limpar', 'aria-label': 'Limpar resposta da ' + nome, texto: 'Limpar resposta', onclick: function () {
      Array.prototype.forEach.call(fs.querySelectorAll('input'), function (i) { i.checked = false; });
      definirResposta(item, null);
      anunciar('Resposta da ' + nome + ' apagada.');
    } }));
    return fs;
  }

  function campoTexto(codigo, texto, valor, aoMudar) {
    var id = 'txt-' + codigo;
    var contador = h('p', { classe: 'contador', id: id + '-cont', 'aria-live': 'off' });
    var ta = h('textarea', { id: id, name: codigo, rows: '5', maxlength: String(IDCGT_MAX_TEXTO), 'aria-describedby': id + '-cont' });
    ta.value = valor || '';
    function atualizar() { contador.textContent = ta.value.length + ' de ' + IDCGT_MAX_TEXTO + ' caracteres'; }
    ta.addEventListener('input', function () { aoMudar(ta.value); atualizar(); });
    atualizar();
    return h('div', { classe: 'item aberta', id: 'item-' + codigo },
      h('label', { for: id }, h('span', { classe: 'codigo', texto: codigo }), ' ', texto, h('span', { classe: 'facultativa', texto: ' (facultativa)' })),
      ta, contador);
  }

  function definirResposta(item, valor) {
    estado.respostas[item.codigo] = valor;
    if (item.codigo === 'Q08' && valor !== 1) {
      var havia = IDCGT_GERENCIAIS.some(function (c) { return estado.respostas[c] !== null && estado.respostas[c] !== undefined; });
      IDCGT_GERENCIAIS.forEach(function (c) { delete estado.respostas[c]; });
      if (havia) anunciar('As respostas do bloco de competências gerenciais foram apagadas, pois o bloco não se aplica à resposta da Q08.');
    }
    if (item.codigo === 'Q08') atualizarIndicador();
  }

  var indicadorAtual = null;
  function atualizarIndicador() {
    if (!indicadorAtual) return;
    var m = /^#\/questionario\/(\d+)$/.exec(location.hash);
    if (m) indicadorAtual.textContent = 'Etapa ' + m[1] + ' de ' + etapas().length;
  }

  function telaQuestionario(n) {
    var lista = etapas();
    if (n < 1 || n > lista.length) return ir('#/questionario/1');
    var etapa = lista[n - 1];
    var conteudo = [];
    indicadorAtual = h('p', { classe: 'progresso', texto: 'Etapa ' + n + ' de ' + lista.length });
    conteudo.push(indicadorAtual);

    if (n === 1) {
      conteudo.push(h('section', { classe: 'instrucoes', 'aria-label': 'Instruções' },
        h('p', { texto: TEXTOS.instrucoes }),
        h('ul', null, h('li', { texto: TEXTOS.escalaFreq }), h('li', { texto: TEXTOS.escalaPrat }))));
    }

    var form = h('form', { novalidate: true, onsubmit: function (e) { e.preventDefault(); } });
    if (etapa.bloco === '__roteiro') {
      form.appendChild(h('p', { texto: TEXTOS.roteiroIntro }));
      var fsCod = h('fieldset', { classe: 'item categorias', id: 'item-codigo_pre_teste' },
        h('legend', { texto: 'Código do participante do pré-teste (P1 a P5), informado pelo pesquisador' }));
      var grp = h('div', { classe: 'opcoes' });
      IDCGT_CODIGOS_PRE_TESTE.forEach(function (c) {
        var inp = h('input', { type: 'radio', name: 'codigo_pre_teste', id: 'cod-' + c, value: c });
        if (estado.extras.codigo_pre_teste === c) inp.checked = true;
        inp.addEventListener('change', function () { estado.extras.codigo_pre_teste = c; });
        grp.appendChild(h('label', { classe: 'opcao', for: 'cod-' + c }, inp, h('span', { texto: c })));
      });
      fsCod.appendChild(grp);
      fsCod.appendChild(h('button', { type: 'button', classe: 'limpar', texto: 'Limpar resposta', onclick: function () {
        Array.prototype.forEach.call(fsCod.querySelectorAll('input'), function (i) { i.checked = false; });
        delete estado.extras.codigo_pre_teste;
      } }));
      form.appendChild(fsCod);
      IDCGT_ROTEIRO_PRE_TESTE.forEach(function (q, i) {
        form.appendChild(campoTexto(q.codigo, (i + 1) + '. ' + q.texto, estado.extras[q.codigo], function (v) { estado.extras[q.codigo] = v; }));
      });
    } else {
      if (etapa.bloco === 'Competências gerenciais') {
        form.appendChild(h('p', { classe: 'nota', texto: 'Este bloco é exibido porque, na Q08, você indicou possuir responsabilidade formal ou informal pela coordenação de pessoas, equipes ou projetos.' }));
      }
      itensDoBloco(etapa.bloco).forEach(function (item) {
        if (item.tipo === 'texto') {
          form.appendChild(campoTexto(item.codigo, item.texto, estado.respostas[item.codigo], function (v) { estado.respostas[item.codigo] = v; }));
        } else {
          form.appendChild(campoItem(item));
        }
      });
    }
    conteudo.push(form);

    var ultima = n === lista.length;
    conteudo.push(h('nav', { classe: 'navegacao', 'aria-label': 'Navegação entre etapas' },
      n > 1 ? h('button', { type: 'button', classe: 'botao', texto: 'Anterior', onclick: function () { ir('#/questionario/' + (n - 1)); } }) : null,
      h('button', { type: 'button', classe: 'botao primario', id: 'btn-proximo', texto: ultima ? 'Revisar respostas' : 'Próximo', onclick: function () {
        // A lista de etapas pode mudar após a Q08; recalcula na hora de avançar.
        var atual = etapas();
        ir(n >= atual.length ? '#/revisao' : '#/questionario/' + (n + 1));
      } })));
    conteudo.push(botaoCancelar());
    tela(etapa.titulo, conteudo);
  }

  function botaoCancelar() {
    var caixa = h('div', { classe: 'cancelar' });
    function desenhar() {
      caixa.textContent = '';
      if (!estado.confirmarCancelamento) {
        caixa.appendChild(h('button', { type: 'button', classe: 'botao discreto', id: 'btn-cancelar', texto: 'Cancelar participação', onclick: function () {
          estado.confirmarCancelamento = true; desenhar(); caixa.querySelector('button').focus();
        } }));
      } else {
        caixa.appendChild(h('div', { role: 'alertdialog', 'aria-labelledby': 'conf-canc', classe: 'confirmacao' },
          h('p', { id: 'conf-canc', texto: 'Deseja cancelar a participação? As respostas desta tela serão apagadas e nada será enviado.' }),
          h('button', { type: 'button', classe: 'botao perigo', id: 'btn-confirmar-cancelar', texto: 'Sim, cancelar', onclick: function () {
            estado = novoEstado(); estado.fim = 'cancelado'; ir('#/cancelado');
          } }),
          h('button', { type: 'button', classe: 'botao', texto: 'Não, continuar', onclick: function () {
            estado.confirmarCancelamento = false; desenhar(); caixa.querySelector('button').focus();
          } })));
      }
    }
    desenhar();
    return caixa;
  }

  // ------------------------------------------------------------- revisão
  function exibirValor(item, v) {
    if (v === null || v === undefined || v === '') return null;
    if (item.tipo === 'texto') return v;
    for (var i = 0; i < item.opcoes.length; i++) if (item.opcoes[i].valor === v) return rotuloEscala(item, item.opcoes[i]);
    return null;
  }

  function linhaRevisao(codigo, texto, valor) {
    var vazio = valor === null || (typeof valor === 'string' && !valor.trim());
    return [
      h('dt', null, h('span', { classe: 'codigo', texto: codigo }), ' ', texto),
      h('dd', { classe: vazio ? 'vazio' : (codigo.charAt(0) === 'P' || /^Q3[5-9]$/.test(codigo) ? 'texto-livre' : null), texto: vazio ? 'Sem resposta' : valor })
    ];
  }

  function telaRevisao() {
    var lista = etapas();
    var secoes = [];
    lista.forEach(function (et, idx) {
      var dl = h('dl', { classe: 'resumo' });
      if (et.bloco === '__roteiro') {
        linhaRevisao('Código', 'Código do participante do pré-teste', estado.extras.codigo_pre_teste || null).forEach(function (x) { dl.appendChild(x); });
        IDCGT_ROTEIRO_PRE_TESTE.forEach(function (q, i) {
          linhaRevisao(q.codigo, (i + 1) + '. ' + q.texto, estado.extras[q.codigo] || null).forEach(function (x) { dl.appendChild(x); });
        });
      } else {
        itensDoBloco(et.bloco).forEach(function (item) {
          linhaRevisao(item.codigo, item.texto, exibirValor(item, estado.respostas[item.codigo])).forEach(function (x) { dl.appendChild(x); });
        });
      }
      secoes.push(h('section', { classe: 'bloco-revisao', 'aria-labelledby': 'rev-' + idx },
        h('div', { classe: 'cab-bloco' },
          h('h2', { id: 'rev-' + idx, texto: et.titulo }),
          h('button', { type: 'button', classe: 'botao discreto', 'aria-label': 'Alterar respostas: ' + et.titulo, texto: 'Alterar', onclick: function () { ir('#/questionario/' + (idx + 1)); } })),
        dl));
      if (et.bloco === 'Práticas organizacionais' && estado.respostas.Q08 !== 1) {
        secoes.push(h('p', { classe: 'nota', texto: 'O bloco de competências gerenciais (Q27 a Q34) não foi exibido, conforme a resposta à Q08, e não será enviado.' }));
      }
    });

    var erro = h('div', { id: 'erro-envio', classe: 'alerta', role: 'alert', hidden: true });
    var btnEnviar = h('button', { type: 'button', classe: 'botao primario', id: 'btn-enviar', texto: 'Enviar respostas' });
    var btnVoltar = h('button', { type: 'button', classe: 'botao', id: 'btn-voltar', texto: 'Voltar e revisar', onclick: function () { ir('#/questionario/' + lista.length); } });
    btnEnviar.addEventListener('click', function () { enviar(btnEnviar, [btnVoltar], erro); });

    tela('Revisão das respostas', [
      h('p', { texto: TEXTOS.revisao }),
      ambienteDeTeste() && !CFG.endpoint ? h('p', { classe: 'nota', texto: 'Modo demonstração: o envio será apenas simulado neste dispositivo.' }) : null
    ].concat(secoes).concat([
      erro,
      h('div', { classe: 'navegacao' }, btnVoltar, btnEnviar),
      botaoCancelar()
    ]));
  }

  // --------------------------------------------------------------- envio
  /** Código temporário de envio: 128 bits aleatórios, somente em memória. */
  function gerarCodigoEnvio() {
    if (!window.crypto || !window.crypto.getRandomValues) return null;
    var b = window.crypto.getRandomValues(new Uint8Array(16));
    return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }

  function transmitir(corpoTexto, codigoEnvio) {
    if (!CFG.endpoint) {
      // Modo demonstração (somente ambiente de desenvolvimento): nada sai do dispositivo.
      if (!ambienteDeTeste()) return Promise.resolve(false);
      return new Promise(function (r) { setTimeout(function () { r(true); }, 400); });
    }
    if (!idcgtCodigoEnvioValido(codigoEnvio)) return Promise.resolve(false);
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TEMPO_LIMITE_ENVIO) : null;
    return fetch(CFG.endpoint + '?envio=' + codigoEnvio, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: corpoTexto,
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (!r.ok) return false;
      return r.json().then(function (j) { return !!j && j.status === 'ok'; }, function () { return false; });
    }, function () { return false; }).then(function (ok) {
      if (timer) clearTimeout(timer);
      return ok;
    });
  }

  function enviar(btn, outros, caixaErro) {
    if (estado.enviando || estado.enviado) return;
    estado.enviando = true;
    caixaErro.hidden = true;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = 'Enviando…';
    outros.forEach(function (b) { b.disabled = true; });

    var corpo = idcgtMontarSubmissao(estado.respostas, CFG.modo, estado.extras);
    var valido = idcgtValidarSubmissao(corpo, CFG.modo).ok;
    var corpoTexto = JSON.stringify(corpo);
    // O mesmo conteúdo reaproveita o código, para que o servidor reconheça uma
    // nova tentativa após falha de conexão; conteúdo alterado recebe código novo.
    if (!estado.codigoEnvio || estado.corpoTentado !== corpoTexto) {
      estado.codigoEnvio = gerarCodigoEnvio();
      estado.corpoTentado = corpoTexto;
    }
    var envio = valido ? transmitir(corpoTexto, estado.codigoEnvio) : Promise.resolve(false);

    envio.then(function (ok) {
      estado.enviando = false;
      if (ok) {
        estado.enviado = true;
        // Feedback calculado somente após o envio confirmado, apenas na memória.
        estado.feedback = CFG.feedbackHabilitado ? idcgtCalcularFeedback(estado.respostas, window.IDCGT_CURSOS) : null;
        estado.respostas = {};
        estado.extras = {};
        estado.codigoEnvio = null;
        estado.corpoTentado = null;
        if (estado.feedback) ir('#/feedback'); else concluir();
        return;
      }
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = 'Tentar enviar novamente';
      outros.forEach(function (b) { b.disabled = false; });
      caixaErro.textContent = TEXTOS.erro;
      caixaErro.hidden = false;
      caixaErro.setAttribute('tabindex', '-1');
      caixaErro.focus();
    });
  }

  // ------------------------------------------------------------- feedback
  function telaFeedback() {
    var fb = estado.feedback;
    var envio = h('p', { classe: 'sucesso', role: 'status', texto: 'Suas respostas foram enviadas.' });
    if (!estado.feedbackVisivel) {
      return tela('Envio confirmado', [envio,
        h('p', { texto: 'Se desejar, você pode visualizar um resumo opcional para reflexão pessoal. Ele é calculado somente neste dispositivo, não é enviado à pesquisa e não fica disponível para a RBCIP.' }),
        h('div', { classe: 'acoes' },
          h('button', { type: 'button', classe: 'botao primario', id: 'btn-ver-resumo', texto: 'Ver meu resumo', onclick: function () { estado.feedbackVisivel = true; render(); } }),
          h('button', { type: 'button', classe: 'botao', id: 'btn-encerrar', texto: 'Encerrar sem ver o resumo', onclick: concluir }))]);
    }
    var linhas = idcgtFeedbackEmLinhas(fb);
    var corpo = h('div', { classe: 'devolutiva', id: 'devolutiva' });
    var ul = null;
    linhas.slice(1).forEach(function (l) {
      if (l.estilo === 'item') {
        if (!ul) { ul = h('ul'); corpo.appendChild(ul); }
        ul.appendChild(h('li', { texto: l.texto }));
        return;
      }
      ul = null;
      corpo.appendChild(h(l.estilo === 'subtitulo' ? 'h2' : l.estilo === 'bloco' ? 'h3' : 'p', { texto: l.texto }));
    });
    tela(IDCGT_FEEDBACK_TEXTOS.titulo, [envio, corpo,
      h('div', { classe: 'acoes' },
        h('button', { type: 'button', classe: 'botao', id: 'btn-pdf', texto: 'Baixar meu resumo em PDF', onclick: function () { baixarPdf(linhas); } }),
        h('button', { type: 'button', classe: 'botao primario', id: 'btn-encerrar', texto: 'Encerrar e apagar a visualização', onclick: concluir }))]);
  }

  function baixarPdf(linhas) {
    var bytes = idcgtGerarPdf(linhas, 'IDCGT-AP | Resumo individual gerado neste dispositivo e não enviado à pesquisa');
    var url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    var a = h('a', { href: url, download: 'resumo-idcgt-ap.pdf' });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  function concluir() {
    estado = novoEstado();
    estado.fim = 'concluido';
    ir('#/conclusao');
  }

  function telaConclusao() {
    tela('Participação concluída', TEXTOS.conclusao.map(function (t) { return h('p', { texto: t }); })
      .concat([h('p', { texto: CONTATO }), h('p', { texto: 'Você pode fechar esta página.' })]));
  }

  // --------------------------------------------------------------- rotas
  function render() {
    var r = location.hash || '#/';
    ultimaRota = location.hash;
    var m;
    if (r === '#/consentimento' && liberado() && !estado.fim && !estado.enviado) return telaConsentimento();
    if ((m = /^#\/questionario\/(\d+)$/.exec(r)) && estado.consentiu && !estado.enviado) return telaQuestionario(parseInt(m[1], 10));
    if (r === '#/revisao' && estado.consentiu && !estado.enviado) return telaRevisao();
    if (r === '#/feedback' && estado.enviado && estado.feedback) return telaFeedback();
    if (r === '#/conclusao' && estado.fim === 'concluido') return telaConclusao();
    if (r === '#/recusa' && estado.fim === 'recusa') return telaFim('Participação não iniciada', TEXTOS.recusa);
    if (r === '#/cancelado' && estado.fim === 'cancelado') return telaFim('Participação cancelada', TEXTOS.cancelado);
    if (estado.enviado && estado.feedback) { history.replaceState(null, '', '#/feedback'); return render(); }
    if (r !== '#/' && r !== '') { history.replaceState(null, '', '#/'); ultimaRota = '#/'; }
    telaInicio();
  }

  function avisoAmbiente() {
    var el = document.getElementById('aviso-ambiente');
    document.getElementById('versao').textContent = CFG.versao || '';
    Array.prototype.forEach.call(document.querySelectorAll('[data-doc="tcle"]'), function (a) { a.setAttribute('href', CFG.documentos.tcle); });
    if (!ambienteDeTeste()) return;
    el.hidden = false;
    el.textContent = 'Ambiente de desenvolvimento e testes — utilize somente dados fictícios. ' +
      (CFG.endpoint ? 'As respostas serão enviadas ao endpoint de teste.' : 'Modo demonstração: nenhuma resposta sai deste dispositivo.');
  }

  window.addEventListener('beforeunload', function (e) {
    if (estado.consentiu && !estado.enviado && temResposta()) { e.preventDefault(); e.returnValue = ''; }
  });
  window.addEventListener('hashchange', aoNavegar);
  window.addEventListener('popstate', aoNavegar);
  avisoAmbiente();
  render();
})();
