import { Component } from '@angular/core';

import { Review } from '../../../modelos/Review';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './review.component.html',
  styleUrl: './review.component.css'
})
export class ReviewComponent {


  // listaReviews[] : Review = [any];

  constructor(){

  }

  ngOnInit(){
    
  }

  addReview(){
    console.log("Añadir nueva reseña");
  }

}
