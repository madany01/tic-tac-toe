'use strict'

const pubSub = (function () {
	const eventListeners = new Map()

	function ensureEventArrayExists(event) {
		if (!eventListeners.has(event)) eventListeners.set(event, [])
	}

	function register(eventName, handler) {
		ensureEventArrayExists(eventName)
		eventListeners.get(eventName).push(handler)
	}

	function unregister(eventName, handler) {
		ensureEventArrayExists(eventName)
		const existsHandlers = eventListeners.get(eventListeners)
		const filteredHandlers = existsHandlers.filter(
			existsHandler => existsHandler !== handler
		)
		eventListeners.set(eventName, filteredHandlers)
	}

	function notify(eventName, ...args) {
		ensureEventArrayExists()
		eventListeners.get(eventName).forEach(handler => handler(...args))
	}

	return {
		register,
		unregister,
		notify
	}
})()


const displayController = (function () {
	const MSG_TIE = 0
	const MSG_WIN = 1

	const msgEl = document.querySelector('.msg')
	const againBtn = document.querySelector('button.again')
	const roundEl = document.querySelector('.round-number')
	const resetBtn = document.querySelector('.reset-btn')
	const restartBtn = document.querySelector('.restart-btn')

	function showMessage(content, msgType) {
		msgEl.classList.remove('msg-tie', 'msg-winning')
		msgEl.classList.add(msgType === MSG_WIN ? 'msg-winning' : 'msg-tie')
		msgEl.textContent = content
		msgEl.classList.remove('d-none')
	}

	function init() {
		bindEvents()
	}

	function bindEvents() {
		againBtn.addEventListener('click', handleAgainBtnClick)
		resetBtn.addEventListener('click', resetBtnClicked)
		restartBtn.addEventListener('click', restartBtnClicked)
	}

	function resetBtnClicked() {
		pubSub.notify('resetButtonClicked')
	}

	function restartBtnClicked() {
		pubSub.notify('restartButtonClicked')
	}

	function handleAgainBtnClick() {
		pubSub.notify('restartGame')
	}

	function hideMessage() {
		msgEl.classList.add('d-none')
	}

	function showAgainBtn() {
		againBtn.classList.remove('d-none')
	}

	function hideAgainBtn() {
		againBtn.classList.add('d-none')
	}

	function setRound(num) {
		roundEl.textContent = num
	}

	init()

	return {
		MSG_TIE,
		MSG_WIN,
		showMessage,
		hideMessage,
		showAgainBtn,
		hideAgainBtn,
		setRound,
	}
})()


const modal = (function () {
	const SINGLE = 0
	const MULTI = 1
	const computerName = 'computer 🤖'

	const el = document.querySelector('.modal')
	const overlayEl = document.querySelector('.overlay')
	const closeIcon = el.querySelector('.close-icon')
	const [modeSingleBtn, modeMultiBtn] = el.querySelectorAll('.game-mode-ctr button')
	const nameInputs = el.querySelectorAll('.player-name-input')
	const nameLabels = el.querySelectorAll('.player-name-label')
	const dimensionInput = el.querySelector('.board-dimension')
	const actionBtn = el.querySelector('.action-btn')

	let hideEnabled = false
	let currentMode = SINGLE

	function init() {
		bindEvents()
	}

	function bindEvents() {
		closeIcon.addEventListener('click', handleCloseClick);
		overlayEl.addEventListener('click', handleCloseClick);
		;[modeSingleBtn, modeMultiBtn].forEach(btn => btn.addEventListener('click', switchGameMode))
		nameInputs.forEach(inp => inp.addEventListener('input', highlightInputOnError))
		actionBtn.addEventListener('click', handleActionBtn)
	}

	function isInputValid(inp) {
		const val = inp.value.trim()
		return val && (currentMode === SINGLE ? val.toLowerCase() !== computerName : true)
	}

	function clearInputs() {
		nameInputs.forEach(inp => {
			inp.value = inp.dataset.initialValue
			inp.classList.remove('invalid')
		})
		dimensionInput.value = dimensionInput.dataset.initialValue
	}

	function handleCloseClick(e) {
		if (hideEnabled) hide()
	}

	function switchGameMode(e) {
		if (e.target.classList.contains('selected')) return

		modeSingleBtn.classList.toggle('selected')
		modeMultiBtn.classList.toggle('selected')

		nameLabels[1].classList.toggle('d-none')
		nameInputs[1].classList.toggle('d-none')

		currentMode = modeSingleBtn.classList.contains('selected') ? SINGLE : MULTI

		clearInputs()
	}

	function highlightInputOnError(e) {
		if (isInputValid(e.target)) e.target.classList.remove('invalid')
		else e.target.classList.add('invalid')
	}

	function handleActionBtn(e) {
		let isValid = true

		nameInputs.forEach(inp => {
			if (isInputValid(inp) || inp.classList.contains('d-none')) return
			inp.classList.add('invalid')
			isValid = false
		})

		if (!isValid) return

		const opts = {
			dimensions: Number(dimensionInput.value),
			player1: {
				name: nameInputs[0].value,
				marker: 'X',
			},
			player2: {
				name: currentMode === SINGLE ? computerName : nameInputs[1].value,
				marker: 'O',
			}
		}

		if (opts.player1.name === opts.player2.name) {
			opts.player1.name += ' 1'
			opts.player2.name += ' 2'
		}

		if (currentMode === SINGLE) opts.player2.isComputer = true

		pubSub.notify('GameOptionsCompleted', opts)
	}

	function reset() {
		clearInputs()
		modeSingleBtn.classList.add('selected')
		modeMultiBtn.classList.remove('selected')
		nameLabels[1].classList.add('d-none')
		nameInputs[1].classList.add('d-none')
		currentMode = SINGLE
	}

	function hide(withReset = true) {
		if (withReset) reset()
		el.classList.add('d-none')
		overlayEl.classList.add('d-none')
	}

	function show() {
		el.classList.remove('d-none')
		overlayEl.classList.remove('d-none')
	}

	function enableClosing() {
		closeIcon.classList.remove('disabled')
		hideEnabled = true
	}

	init()

	return {
		show,
		hide,
		reset,
		enableClosing,
	}
})()


const board = (function () {
	const WIN_CNT = 3
	const STATE_ON_PROGRESS = 0
	const STATE_TIE = 1
	const STATE_WIN = 2

	const el = document.querySelector('.board')
	const cellEls = []

	const cellTemplate = el.querySelector('script.cell-template').innerHTML

	let enabled = false
	let isSpinning = false
	let n = null
	let m = null
	const grid = []
	const winningPositions = []

	function init() {
		bindEvents()
	}

	function bindEvents() {
		el.addEventListener('click', handleBoardClick)
	}

	function handleBoardClick(e) {
		if (!enabled || isSpinning) return
		const cellEl = e.target.closest('.cell')
		if (!cellEl) return
		const [i, j] = cellEl.dataset.idx.split(' ').map(idx => Number(idx))
		if (!isEmpty(i, j)) return
		pubSub.notify('cellClick', i, j)
	}

	function build(newN, newM) {
		destroy();

		;[n, m] = [newN, newM]

		el.style.cssText = `
			grid-template-columns: repeat(${n}, 1fr);
    	grid-template-rows: repeat(${m}, 1fr);
		`
		for (let i = 0; i < n; i++)
			grid.push(new Array(m).fill(' '))

		let cellsMarkup = ''

		for (let i = 0; i < n; i++)
			for (let j = 0; j < m; j++)
				cellsMarkup += cellTemplate.replace(/{{i}}/g, i).replace(/{{j}}/g, j)

		el.insertAdjacentHTML('beforeend', cellsMarkup)

		const createdCellEls = el.querySelectorAll('.cell')

		for (let i = 0, k = 0; i < n; i++) {
			cellEls.push([])
			for (let j = 0; j < m; j++)
				cellEls[cellEls.length - 1].push(createdCellEls[k++])
		}

	}


	function clearBoard() {
		// board: winning spinning disabled
		el.classList.remove('winning', 'spinning')
	}

	function clearCell(i, j, render = true) {
		// cell: filled cell-x cell-o winning
		if (render) {
			cellEls[i][j].textContent = ' '
			cellEls[i][j].classList.remove('filled', 'cell-x', 'cell-o', 'winning')
		}
		grid[i][j] = ' '
	}

	function clearCells() {
		cellEls.forEach((arr, i) => {
			arr.forEach((_, j) => clearCell(i, j))
		})

		winningPositions.splice(0, winningPositions.length)
	}

	function clear() {
		clearBoard()
		clearCells()
	}

	function destroy() {
		cellEls.forEach(arr => {
			arr.forEach(cellEl => cellEl.remove())
		})

		cellEls.splice(0, cellEls.length)

		grid.splice(0, grid.length)

		winningPositions.splice(0, winningPositions.length)

		clearBoard()

		n = m = null
	}

	function enable() {
		enabled = true
		el.classList.remove('disabled')
	}

	function disable() {
		enabled = false
		el.classList.add('disabled')
	}

	function toggleSpinner() {
		el.classList.toggle('spinning')
		isSpinning = !isSpinning
	}

	function setCell(i, j, marker, render = true) {
		if (render) {
			if (!isEmpty(i, j)) clearCell(i, j)

			cellEls[i][j].classList.add('filled', `cell-${marker.toLowerCase()}`)
			cellEls[i][j].textContent = marker
		}

		grid[i][j] = marker
	}

	function checkWinningAtPos(i, j, stepI, stepJ) {
		const iEnd = i + stepI * WIN_CNT
		const jEnd = j + stepJ * WIN_CNT

		if (iEnd > n || jEnd > m) return false

		const set = new Set()

		// same row, or same column already in End position

		while (i !== iEnd || j !== jEnd) {
			set.add(grid[i][j])
			i += stepI
			j += stepJ
		}

		return set.size === 1 && !isEmpty(i - stepI, j - stepJ)
	}

	function getState() {
		console.assert(n !== null)

		let isWinning = false
		let numFilledCells = 0
		let i, j
		let stepI, stepJ

		outer:
		for (i = 0; i < n; i++)
			for (j = 0; j < m; j++) {
				if (!isEmpty(i, j)) numFilledCells++

				// row
				if (checkWinningAtPos(i, j, 0, 1)) {
					stepI = 0
					stepJ = 1
					isWinning = true
					break outer
				}
				// column
				if (checkWinningAtPos(i, j, 1, 0)) {
					stepI = 1
					stepJ = 0
					isWinning = true
					break outer
				}
				// main diagonal
				if (checkWinningAtPos(i, j, 1, 1)) {
					stepI = 1
					stepJ = 1
					isWinning = true
					break outer
				}
				// secondary diagonal
				if (checkWinningAtPos(i, j, 1, -1)) {
					stepI = 1
					stepJ = -1
					isWinning = true
					break outer
				}
			}

		if (!isWinning)
			return {
				state: (numFilledCells === n * m ? STATE_TIE : STATE_ON_PROGRESS)
			}


		winningPositions.splice(0, winningPositions.length)

		for (let k = 0; k < WIN_CNT; k++)
			winningPositions.push([i + stepI * k, j + stepJ * k])

		return {
			state: STATE_WIN,
			marker: grid[i][j]
		}
	}

	function highlightWinningCells() {
		winningPositions.forEach((pos) => {
			const [i, j] = pos
			cellEls[i][j].classList.add('winning')
		})
	}

	function isEmpty(i, j) {
		return grid[i][j] === ' '
	}
	function at(i, j) {
		return grid[i][j]
	}

	function toString() {
		return grid.map(row => row.join('')).join('|')
	}
	init()

	return {
		build,
		enable,
		disable,
		setCell,
		clearCell,
		toggleSpinner,
		highlightWinningCells,
		getState,
		clear,
		isEmpty,
		get n() { return n },
		get m() { return m },
		get dimensions() {
			return [n, m]
		},
		at,
		toString,
		STATE_ON_PROGRESS,
		STATE_TIE,
		STATE_WIN,
	}
})()


function PlayerFactory(name, marker, el) {
	const nameEl = el.querySelector('.player-name')
	const markerEl = el.querySelector('.player-marker')
	const scoreEl = el.querySelector('.player-score')

	let score = 0

	function init() {
		render()
		clear()
	}

	function render() {
		nameEl.textContent = name
		markerEl.textContent = marker
		scoreEl.textContent = score
	}

	function toggleActive() {
		el.classList.toggle('active')
	}

	function incrementScore() {
		score++
		scoreEl.textContent = score
	}

	function markWinner() {
		el.classList.add('winner')
	}

	function markLoser() {
		el.classList.add('loser')
	}

	function clear() {
		el.classList.remove('active', 'winner', 'loser')
	}

	function getName() {
		return name
	}

	function getMarker() {
		return marker
	}

	function getScore() {
		return score
	}

	init()

	return {
		toggleActive,
		markWinner,
		markLoser,
		incrementScore,
		clear,
		get name() {
			return getName()
		},
		get marker() {
			return getMarker()
		},
		get score() {
			return getScore()
		}
	}

}


function ComputerPlayerFactory(name, marker, el) {

	function getBoardState(board) {
		const { state, marker: winningMarker = null } = board.getState()
		switch (state) {
			case board.STATE_WIN:
				return marker === winningMarker ? +1 : -1
			case board.STATE_TIE:
				return 0
			default:
				return null
		}
	}

	function flipMarker(marker) {
		return marker === 'X' ? 'O' : 'X'
	}

	function isBetter(a, b, isMyMove) {
		if (isMyMove) return a > b
		return a < b
	}

	const cache = new Map()

	function minMax(board, marker, isMyMove) {
		const cacheKey = `${isMyMove ? 1 : 0}${board.toString()}`

		if (cache.has(cacheKey)) return cache.get(cacheKey)

		const state = getBoardState(board)

		if (state !== null) {
			const ret = { cost: state, pos: null }
			cache.set(cacheKey, ret)
			return ret
		}

		let bestCost = 2 * (isMyMove ? -1 : +1)
		let bestPos = null

		outer:
		for (let i = 0; i < board.n; i++)
			for (let j = 0; j < board.m; j++)
				if (board.isEmpty(i, j)) {

					board.setCell(i, j, marker)
					const { cost } = minMax(board, flipMarker(marker), !isMyMove)
					board.clearCell(i, j)

					if (!isBetter(cost, bestCost, isMyMove)) continue

					bestCost = cost
					bestPos = [i, j]

					if (bestCost === (isMyMove ? +1 : -1)) break outer
				}

		const ret = { cost: bestCost, pos: bestPos }

		cache.set(cacheKey, ret)
		return ret
	}

	function makeChoice(board) {
		const { pos } = minMax(board, marker, true)
		return pos
	}

	return Object.assign({
		makeChoice,
		isComputer: true,
	}, PlayerFactory(name, marker, el))
}


const controller = (function () {
	let round = 0
	const players = [null, null]
	let curPlayer = null
	let otherPlayer = null
	const playerParentEls = [
		document.querySelector('.player-1'),
		document.querySelector('.player-2')
	]

	function init() {
		bindEvents()
		modal.show()
	}

	function switchPlayer() {
		curPlayer = curPlayer === players[0] ? players[1] : players[0]
		inferOtherPlayer()
	}

	function inferOtherPlayer() {
		otherPlayer = curPlayer === players[0] ? players[1] : players[0]
	}

	function bindEvents() {
		pubSub.register('GameOptionsCompleted', createGame)
		pubSub.register('cellClick', handleCellClick)
		pubSub.register('restartGame', restartGame)
		pubSub.register('resetButtonClicked', resetBtnClicked)
		pubSub.register('restartButtonClicked', restartGame)
	}

	function createGame(opts) {
		modal.hide()
		modal.enableClosing()

		board.build(opts.dimensions, opts.dimensions)

		players[0] = PlayerFactory(
			opts.player1.name,
			opts.player1.marker,
			playerParentEls[0]
		)

		if (opts.player2.isComputer)
			players[1] = ComputerPlayerFactory(
				opts.player2.name,
				opts.player2.marker,
				playerParentEls[1]
			)
		else
			players[1] = PlayerFactory(
				opts.player2.name,
				opts.player2.marker,
				playerParentEls[1]
			)

		curPlayer = players[0]
		inferOtherPlayer()
		round = 0
		displayController.setRound(round + 1)
		curPlayer.toggleActive()
		board.enable()
	}

	function makeComputerMove() {
		board.toggleSpinner()
		setTimeout(() => {
			const [i, j] = curPlayer.makeChoice(board)
			board.toggleSpinner()
			handleCellClick(i, j)
		}, 300)
	}

	function handleCellClick(i, j) {
		board.setCell(i, j, curPlayer.marker)

		const { state: gameState } = board.getState()

		if (gameState === board.STATE_ON_PROGRESS) {
			curPlayer.toggleActive()
			switchPlayer()
			curPlayer.toggleActive()
			if (curPlayer.isComputer) {
				makeComputerMove()
			}
		}
		else {
			board.disable()
			displayController.showAgainBtn()
			round++

			if (gameState === board.STATE_WIN) {
				board.highlightWinningCells()
				curPlayer.incrementScore()
				curPlayer.markWinner()
				otherPlayer.markLoser()
				displayController.showMessage(
					`${curPlayer.name} wins!`,
					displayController.MSG_WIN
				)
			}
			else {
				displayController.showMessage(
					`tie`,
					displayController.MSG_TIE
				)
			}
		}
	}

	function restartGame() {
		board.clear()
		players.forEach(p => p.clear())
		curPlayer = players[round & 1]
		inferOtherPlayer()
		curPlayer.toggleActive()
		displayController.hideMessage()
		displayController.hideAgainBtn()
		displayController.setRound(round + 1)
		board.enable()
		if (curPlayer.isComputer) makeComputerMove()
	}

	function resetBtnClicked() {
		modal.show()
	}

	init()
})()

document.querySelector('.copyright-year').textContent = new Date().getFullYear()
