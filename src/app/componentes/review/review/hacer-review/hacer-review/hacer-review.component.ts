import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-hacer-review',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './hacer-review.component.html',
  styleUrl: './hacer-review.component.css'
})
export class HacerReviewComponent {

  formulario: FormGroup;
  stars: boolean[] = Array(5).fill(false);

  constructor(private fb: FormBuilder, private router: Router) {
    this.formulario = this.fb.group({
      reviewDate: [''],
      visitedBefore: [false],
      reviewText: [''],
      tags: [''],
      containsSpoilers: [false]
    });
  }

  ngOnInit(): void {}

  puntuar(rating: number): void {
    this.stars = this.stars.map((_, i) => i < rating);
  }

  volver(): void {
    this.router.navigate(['/reviews']);
  }

  guardarReview(): void {
    // Guardar la reseña
    console.log(this.formulario.value);
    // Navegar de regreso a la página de reseñas
    this.router.navigate(['/reviews']);
  }

}
