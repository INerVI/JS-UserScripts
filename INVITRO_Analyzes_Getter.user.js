// ==UserScript==
// @name          INVITRO Analyzes Getter
// @version       0.2
// @namespace     NerV_Scripts
// @author        NerV
// @grant         GM_addStyle
// @grant         GM_xmlhttpRequest
// @grant         GM_setClipboard
// @include       https://lk.invitro.ru/lkkk/*/results/list*
// @run-at        document-end
// @updateURL     https://github.com/INerVI/JS-UserScripts/raw/cript/INVITRO_Analyzes_Getter.user.js
// @noframe
// ==/UserScript==



var $SCRIPT_CONTEXT = this;

var $CHAR_MAIN_BUTTON = '&#8251;',
	$CHAR_ALL_ORDERS = '&#9776;',
	$CHAR_ALL_ORDERS_BUSY = '&infin;',
	$CHAR_ORDER_EMPTY = '&#9787;',
	$CHAR_ORDER_BUSY = '&hellip;',
	$CHAR_ORDER_READY = '&#9786;';

var URL_PREFIX = null;
var ORDERS_RESULTS = { };

var tableContainer = document.getElementById('replaceWithAjax'),
	parseContainer = null,
	currentResultsBtn = null,
	
	resultWindow = null,
	resultWindow_header = null,
	resultWindow_tableContainer = null,
	resultWindow_orderId = null,
	resultWindow_orderDate = null,
	resultWindow_patientName = null,
	resultWindow_patientDate = null;



function AddTableButtons ( ) {
	if (document.getElementById('__us__get_all_orders_btn')) { return; }
	
	var tableNode = tableContainer.getElementsByClassName('table-results-research');
	if (tableNode === null || tableNode.length === 0) { return; }
	tableNode = tableNode[0];
	
	var tableLines = tableContainer.getElementsByTagName('tr');
	var reOID = /showTestDetails\(event, '([a-z\d]+)'\)/i;
	var oid = null;
	
	tableLines[0].insertAdjacentHTML('afterBegin', '<td id="__us__get_all_orders_btn" class="--us--button --us--main-button">' + $CHAR_ALL_ORDERS + '</td>');
	tableLines[0].firstElementChild.addEventListener('click', OnClickGetAllOrdersButton, false);
	for (var i = 1, l = tableLines.length; i < l; i++) {
		oid = reOID.exec(tableLines[i].innerHTML)[1];
		tableLines[i].insertAdjacentHTML('afterBegin',
			'<td id="__us__get_order_btn_' + oid + '" class="--us--get-order-btn --us--button" data-oid="' + oid + '" data-status="0">'
			+ (ORDERS_RESULTS[oid]? $CHAR_ORDER_READY : $CHAR_ORDER_EMPTY) + '</td>');
		tableLines[i].firstElementChild.addEventListener('click', OnClickGetOrderButton, false);
	}
}


function GetAllOrders ( allOrdersBtn ) {
	var btnList = tableContainer.getElementsByClassName('--us--get-order-btn');
	if (btnList === null || btnList.length < 1) { return; }
	
	var length = btnList.length, index = -1;
	
	var promiseThen = (( answer ) => {
		index++;
		if (index >= length) {
			allOrdersBtn.innerHTML = $CHAR_ALL_ORDERS;
			allOrdersBtn.className = allOrdersBtn.className.replace(' --us--busy-button', '');
			promiseThen = null; return;
		}
		
		new Promise (
			(( promRes ) => { GetOrder(btnList[index], promRes); })
		).then(promiseThen);
	});
	
	allOrdersBtn.innerHTML = $CHAR_ALL_ORDERS_BUSY;
	allOrdersBtn.className += ' --us--busy-button';
	promiseThen(null);
}

function GetOrder ( orderButton, callback ) {
	orderButton.innerHTML = $CHAR_ORDER_BUSY;
	
	var oid = orderButton.getAttribute('data-oid');
	if (ORDERS_RESULTS[oid]) {
		orderButton.innerHTML = $CHAR_ORDER_READY;
		if (callback) { callback(true); } else { ShowResultsWindow(oid); }
		return true;
	}

	new Promise (
		(( promRes ) => { GetOrderPage(oid, promRes); })
	).then(( answer ) => {
			orderButton.innerHTML = (answer? $CHAR_ORDER_READY : $CHAR_ORDER_EMPTY);
			if (callback) { callback(answer); }
			else if (answer) { ShowResultsWindow(oid); }
		}
	);
}


function GetOrderPage ( oid, callback ) {
	GM_xmlhttpRequest({
		method: 'GET',
		url: URL_PREFIX + '/details?token=' + oid,
		headers: { 'Host': 'lk.invitro.ru' },
		timeout: 15000,
		onloadend: OrderPageResponse.bind($SCRIPT_CONTEXT, oid, callback)
	});
}

function OrderPageResponse ( oid, resultCallback, xhrResponse ) {
	if (xhrResponse.status !== 200) { resultCallback(false); return; }
	parseContainer.innerHTML = xhrResponse.responseText.replace(/^[\S\s]+<main[^>]+>/i, '')
												.replace(/<\/main>[\S\s]+$/i, '');
	ParseOrderPage(oid); parseContainer.innerHTML = '';
	resultCallback(true);
}


function ParseOrderPage ( oid ) {
	var orderValue = NormalizeVariable(parseContainer.getElementsByClassName('inz-head__big-title')[0].innerHTML
							.replace('ИНЗ', '').replace('от', '')).split(' ');
	var orderInfo = {
		order_id: orderValue[0],
		order_date: orderValue[1],
		patient_name: NormalizeVariable(parseContainer.getElementsByClassName('result-patient-info__desc')[0].innerHTML),
		patient_date: '-',
		analyzes: [ ]
	};
	
	var tableRows = parseContainer.querySelectorAll('.table-results tbody tr');
	for (var i = 0, l = tableRows.length; i < l; i++) {
		if (tableRows[i].childElementCount > 2) {
			orderInfo.analyzes.push([
				NormalizeVariable(tableRows[i].getElementsByClassName('analysis-name__title-text')[0].innerHTML),
				NormalizeVariable(tableRows[i].getElementsByClassName('table-results__result')[0].innerHTML),
				NormalizeVariable(tableRows[i].getElementsByClassName('table-results__comment')[0].innerHTML) || '---'
			]);
		} else {
			orderInfo.analyzes.push([
				NormalizeVariable(tableRows[i].getElementsByClassName('analysis-name__title-text')[0].innerHTML),
				NormalizeVariable(tableRows[i].children[1].innerHTML), '---'
			]);
		}
	}
	
	orderInfo.resultsTableHTML = MakeOrderHTML(oid, orderInfo);
	ORDERS_RESULTS[oid] = orderInfo;
	return true;
}


function MakeOrderHTML ( oid, orderInfo ) {
	var analysis = null;
	var html = '', cls = ''; 
	
	for (var i = 0, l = orderInfo.analyzes.length; i < l; i++) {
		analysis = orderInfo.analyzes[i]; cls = '';
		if (/обрабат/i.test(analysis[1])) { cls = '__us_result-type--warning'; } else
		if (/б\/п/i.test(analysis[1])) { cls = '__us_result-type--warning'; } else
		if (/см\.\s*?комм/i.test(analysis[1])) { cls = '__us_result-type--warning'; } else
		if (/положит/i.test(analysis[1])) { cls = '__us_result-type--alert'; } else
		if (/^обнаруж/i.test(analysis[1])) { cls = '__us_result-type--alert'; }
		html += '<tr class="' + cls + '"><td>' + orderInfo.analyzes[i].join('</td><td>') + '</td></tr>';
	}
	
	return '<table id="__us__table_results">' + html + '</table>';
}

function ShowResultsWindow ( oid ) {
	HideResultsWindow();
	
	resultWindow_orderId.innerHTML = ORDERS_RESULTS[oid].order_id;
	resultWindow_orderDate.innerHTML = ORDERS_RESULTS[oid].order_date;
	resultWindow_patientName.innerHTML = ORDERS_RESULTS[oid].patient_name;
	resultWindow_patientDate.innerHTML = ORDERS_RESULTS[oid].patient_date;
	resultWindow_tableContainer.innerHTML = ORDERS_RESULTS[oid].resultsTableHTML;
	
	resultWindow.style.display = 'block';
	currentResultsBtn = document.getElementById('__us__get_order_btn_' + oid);
	currentResultsBtn.className += ' --us--selected-button';
}

function HideResultsWindow (  ) {
	resultWindow.style.display = 'none';
	resultWindow_tableContainer.innerHTML = '';
	if (currentResultsBtn) {
		currentResultsBtn.className = currentResultsBtn.className.replace(' --us--selected-button', '');
		currentResultsBtn = null;
	}
}


function OnWindowResize ( event ) {
	resultWindow.style.maxHeight = (document.documentElement.clientHeight - 20) + 'px';
}

function OnClickMainButton ( event ) {
	AddTableButtons();
}

function OnClickGetAllOrdersButton ( event ) {
	GetAllOrders(this);
}

function OnClickGetOrderButton ( event ) {
	GetOrder(this);
}

function OnClickOrderInfoValue ( event ) {
	GM_setClipboard(this.innerHTML);
}



((function ( ) {
	URL_PREFIX = location.href.replace(/\/list.*?$/i, '');
	document.body.insertAdjacentHTML('beforeEnd',
		'<div id="__us__parse_container"></div>' +
		'<div id="__us__results_window" style="display: none;" data-oid="">' +
			'<div id="__us__results_window_header">' +
				'<span id="__us__results_window_close_btn" class="--us--button">&#10006;</span>' +
			'</div>' +
			'<div>' +
				'<table class="--us--result-window-info-table">' +
					'<tr>' +
						'<td id="__us__results_window_order_id" title="Скопировать номер заказа в буфер обмена">-</td>' +
						'<td id="__us__results_window_order_date" title="Скопировать дату заказа в буфер обмена">-</td>' +
					'</tr>' +
					'<tr>' +
						'<td id="__us__results_window_patient_name" title="Скопировать имя пациента в буфер обмена">-</td>' +
						'<td id="__us__results_window_patient_birthday" title="Скопировать дату рождения пациента в буфер обмена">-</td>' +
					'</tr>' +
				'</table>' +
			'</div>' +
			'<div id="__us__results_window_table_container"></div>' +
		'</div>' +
		'<div id="__us__script_button" class="--us--button --us--main-button">' + $CHAR_MAIN_BUTTON + '</div>'
	);
	document.getElementById('__us__script_button').addEventListener('click', OnClickMainButton, false);
	parseContainer = document.getElementById('__us__parse_container');
	
	resultWindow = document.getElementById('__us__results_window');
	resultWindow_header = document.getElementById('__us__results_window_header');
	resultWindow_tableContainer = document.getElementById('__us__results_window_table_container');
	resultWindow_orderId = document.getElementById('__us__results_window_order_id');
	resultWindow_orderId.addEventListener('click', OnClickOrderInfoValue, false);
	resultWindow_orderDate = document.getElementById('__us__results_window_order_date');
	resultWindow_orderDate.addEventListener('click', OnClickOrderInfoValue, false);
	resultWindow_patientName = document.getElementById('__us__results_window_patient_name');
	resultWindow_patientName.addEventListener('click', OnClickOrderInfoValue, false);
	resultWindow_patientDate = document.getElementById('__us__results_window_patient_birthday');
	resultWindow_patientDate.addEventListener('click', OnClickOrderInfoValue, false);
	
	document.getElementById('__us__results_window_close_btn').addEventListener('click', HideResultsWindow, false);
	
	OnWindowResize();
	window.addEventListener('resize', OnWindowResize, false);
	
})());


function NormalizeVariable ( str ) { return str.trim().replace(/\s{2,}/g, ' '); }



GM_addStyle(
	'#__us__parse_container { display: none; }\r\n' +
	 
	'.--us--button { '
		+ 'background: none no-repeat #fff; color: #000; '
		+ 'font-weight: bold; text-align: center; '
		+ 'cursor: pointer; '
	+ '}\r\n' +
	'.--us--button:hover, .--us--main-button, .--us--selected-button { '
		+ 'background-color: #66c1cc; color: #fff; '
	+ '}\r\n' +
	'.--us--main-button:hover, .--us--busy-button { '
		+ 'background-color: #ff8000; '
	+ '}\r\n' +
	 
	'#__us__script_button { '
		+ 'display: inline-block; width: 50px; height: 50px; '
		+ 'position: fixed; bottom: 10px; right: 10px; '
		+ 'border: solid 1px #fff; border-radius: 3px; '
		+ 'font-size: 34px; '
		+ 'cursor: pointer; '
	+ '}\r\n' +
	
	'#__us__get_all_orders_btn, .--us--get-order-btn { '
		+ 'padding: 0 15px;'
		+ 'position: relative; z-index: 1; '
	+ '}\r\n' +
	
	'#__us__results_window { '
		+ 'min-width: 470px; max-width: 60%; '
		+ 'position: fixed; top: 10px; right: 10px; z-index: 10; '
		+ 'padding-bottom: 3px; border: solid 1px #000; '
		+ 'overflow-y: auto;'
		+ 'background: none no-repeat #66c1cc !important; color: #000; '
	+ '}\r\n' +
	'#__us__results_window > * { '
		+ 'padding: 5px 3px 0 3px; '
	+ '}\r\n' +
	
	'#__us__results_window_header { background-color: #000; padding: 1px 3px; }\r\n' +
	'#__us__results_window_header.--us--part { background-color: #ff8000; }\r\n' +
	'#__us__results_window_header.--us--ready { background-color: #66c1cc; }\r\n' +
	'#__us__results_window_header:before { '
		+ 'display: inline-block; '
		+ 'content: "Результаты анализов"; '
		+ 'padding: 1px 0; border: solid 1px transparent; '
		+ 'color: #fff; '
	+ '}\r\n' +
	'#__us__results_window_header.--us--part:before { content: "Результаты анализов (Частично готовы)" }\r\n' +
	'#__us__results_window_header.--us--ready:before { content: "Результаты анализов (Готовы)" }\r\n' +
	
	'#__us__results_window_close_btn { '
		+ 'float: right; '
		+ 'display: inline-block; '
		+ 'padding: 1px 5px; border: solid 1px #000; '
	+ '}\r\n' +
	
	'#__us__results_window table { '
		+ 'width: 100%; min-width: 180px; '
		+ 'border-collapse: collapse; border-spacing: 0; '
		+ 'background: none no-repeat transparent; '
	+ '}\r\n' +
	
	'.--us--result-window-info-table { '
		+ 'font-weight: bold; '
		// + 'color: #fff; '
	+ '}\r\n' +
	'.--us--result-window-info-table td { cursor: pointer; }\r\n' +
	'.--us--result-window-info-table td:last-child { width: 40%; }\r\n' +
	'.--us--result-window-info-table td:hover { color: #ff8000; }\r\n' +
	
	'.--us--result-window-info-table td:before { font-weight: normal; }\r\n' +
	'#__us__results_window_order_id:before { content: "Номер заказа: "; }\r\n' +
	'#__us__results_window_order_date:before { content: "Дата заказа: "; }\r\n' +
	'#__us__results_window_patient_name:before { content: "Пациент: "; display: inline-block; width: 100%; }\r\n' +
	'#__us__results_window_patient_birthday:before { content: "Дата рождения: "; display: inline-block; width: 100%; }\r\n' +
	
	'#__us__results_window_table_container { '
		+ 'background: none no-repeat transparent; '
	+ '}\r\n' +
	
	'#__us__table_results { '
		+ 'background: none no-repeat #fff !important; '
	+ '}\r\n' +
	'#__us__table_results td { '
		+ 'padding: 5px; border: solid 1px #000; '
		+ 'background: none no-repeat transparent; '
	+ '}\r\n' +
	
	'.__us_result-type--warning { background: none no-repeat #ffffcc !important;  }\r\n' +
	'.__us_result-type--alert { background: none no-repeat #ffaaaa !important;  }\r\n'
);
