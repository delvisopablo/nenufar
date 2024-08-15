import { Component, inject } from '@angular/core';
import { Router ,RouterLink } from '@angular/router';

@Component({
  selector: 'app-juego',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './juego.component.html',
  styleUrls: ['./juego.component.css'] ,

})
export class JuegoComponent {

timeLeftDisplay = document.querySelector('#time-left');
resultDisplay = document.querySelector('#result');
startPauseButton = document.querySelector('#start-pause-button');
squares = document.querySelectorAll('.grid div');
logsLeft = document.querySelectorAll('.log-left');
logsRight = document.querySelectorAll('.log-right');
carsLeft = document.querySelectorAll('.car-left');
carsRight = document.querySelectorAll('.car-right');

currentIndex = 76;
width = 9;
timerId: any;
outcomeTimerId: any;
currentTime = 20;

moveFrog(e : any) {
    this.squares[this.currentIndex].classList.remove('frog')

    switch(e.key) {
        case 'ArrowLeft' :
             if (this.currentIndex % this.width !== 0) this.currentIndex -= 1
            break
        case 'ArrowRight' :
            if (this.currentIndex % this.width < this.width - 1) this.currentIndex += 1
            break
        case 'ArrowUp' :
            if (this.currentIndex - this.width >=0 ) this.currentIndex -= this.width
            break
        case 'ArrowDown' :
            if (this.currentIndex + this.width < this.width * this.width) this.currentIndex += this.width
            break
    }
    this.squares[this.currentIndex].classList.add('frog')
}

autoMoveElements() {
  this.currentTime--
  // this.timeLeftDisplay.textContent = this.currentTime
  this.logsLeft.forEach(logLeft => this.moveLogLeft(logLeft))
  this.logsRight.forEach(logRight => this.moveLogRight(logRight))
  this.carsLeft.forEach(carLeft => this.moveCarLeft(carLeft))
  this.carsRight.forEach(carRight => this.moveCarRight(carRight))
}

checkOutComes() {
  this.lose()
  this.win()
}

moveLogLeft(logLeft: any) {
    switch(true) {
        case logLeft.classList.contains('l1') :
            logLeft.classList.remove('l1')
            logLeft.classList.add('l2')
            break
        case logLeft.classList.contains('l2') :
            logLeft.classList.remove('l2')
            logLeft.classList.add('l3')
            break
        case logLeft.classList.contains('l3') :
            logLeft.classList.remove('l3')
            logLeft.classList.add('l4')
            break
        case logLeft.classList.contains('l4') :
            logLeft.classList.remove('l4')
            logLeft.classList.add('l5')
            break
        case logLeft.classList.contains('l5') :
            logLeft.classList.remove('l5')
            logLeft.classList.add('l1')
            break
    }
}

moveLogRight(logRight : any) {
    switch(true) {
        case logRight.classList.contains('l1') :
            logRight.classList.remove('l1')
            logRight.classList.add('l5')
            break
        case logRight.classList.contains('l2') :
            logRight.classList.remove('l2')
            logRight.classList.add('l1')
            break
        case logRight.classList.contains('l3') :
            logRight.classList.remove('l3')
            logRight.classList.add('l2')
            break
        case logRight.classList.contains('l4') :
            logRight.classList.remove('l4')
            logRight.classList.add('l3')
            break
        case logRight.classList.contains('l5') :
            logRight.classList.remove('l5')
            logRight.classList.add('l4')
            break
    }
}

moveCarLeft(carLeft: any) {
    switch(true) {
        case carLeft.classList.contains('c1') :
            carLeft.classList.remove('c1')
            carLeft.classList.add('c2')
            break
        case carLeft.classList.contains('c2') :
            carLeft.classList.remove('c2')
            carLeft.classList.add('c3')
            break
        case carLeft.classList.contains('c3') :
            carLeft.classList.remove('c3')
            carLeft.classList.add('c1')
            break
    }
}

moveCarRight(carRight: any) {
    switch(true) {
        case carRight.classList.contains('c1') :
            carRight.classList.remove('c1')
            carRight.classList.add('c3')
            break
        case carRight.classList.contains('c2') :
            carRight.classList.remove('c2')
            carRight.classList.add('c1')
            break
        case carRight.classList.contains('c3') :
            carRight.classList.remove('c3')
            carRight.classList.add('c2')
            break
    }
}

lose() {
    if (
      this.squares[this.currentIndex].classList.contains('c1') ||
      this.squares[this.currentIndex].classList.contains('l4') ||
      this.squares[this.currentIndex].classList.contains('l5') ||
      this.currentTime <= 0
    ) {
        // this.resultDisplay = 'You lose!'
        clearInterval(this.timerId)
        clearInterval(this.outcomeTimerId)
        this.squares[this.currentIndex].classList.remove('frog')
        document.removeEventListener('keyup', this.moveFrog)
    }
}

win() {
    if (this.squares[this.currentIndex].classList.contains('ending-block')) {
// resultDisplay.textContent = 'You Win!'
        clearInterval(this.timerId)
        clearInterval(this.outcomeTimerId)
        document.removeEventListener('keyup', this.moveFrog)
    }
}

//  startPauseButton.addEventListener('click', () => {
//     if (timerId) {
//         clearInterval(timerId)
//         clearInterval(outcomeTimerId)
//         outcomeTimerId = null
//         timerId = null
//         document.removeEventListener('keyup', moveFrog)
//     } else {
//         timerId = setInterval(autoMoveElements, 1000)
//         outcomeTimerId = setInterval(checkOutComes, 50)
//         document.addEventListener('keyup', moveFrog)
//     }
// })

}
